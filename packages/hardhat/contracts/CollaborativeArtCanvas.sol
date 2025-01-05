// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Import necessary OpenZeppelin contracts
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PaintToken.sol";

/// @title CollaborativeArtCanvas
/// @notice A contract that allows users to collaboratively create pixel art by purchasing and setting pixel colors
contract CollaborativeArtCanvas is Ownable, ReentrancyGuard {
    // Constants for canvas dimensions
    uint16 public constant CANVAS_WIDTH = 64;
    uint16 public constant CANVAS_HEIGHT = 64;
    uint256 public constant TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT;

    /// @notice Represents a pixel on the canvas
    struct Pixel {
        uint24 color;
    }

    /// @notice Mapping from pixel ID to Pixel data
    mapping(uint256 => Pixel) public pixels;

    /// @notice Emitted when a pixel's color is changed
    event PixelChanged(uint256 indexed pixelId, uint256 color);

    /// @notice Emitted when a user purchases PaintTokens
    event PaintTokensPurchased(address indexed buyer, uint256 amount, uint256 totalPrice);

    // Paint Token Variables
    uint256 public constant PAINT_TOKEN_PRICE = 250 gwei; // 2.5e-7 ether in wei
    uint256 public constant PAINT_TOKEN_SUPPLY = 10_000_000 * 10 ** 18; // Assuming 18 decimals
    uint256 private constant DECIMALS = 10 ** 18; // Token decimals

    PaintToken public paintToken;

    /// @notice Constructor that deploys the PaintToken contract and sets the initial owner
    /// @param initialOwner The address of the initial owner
    constructor(address initialOwner) Ownable(initialOwner) {
        // Deploy the PaintToken contract with the initial supply, owned by this contract
        paintToken = new PaintToken(PAINT_TOKEN_SUPPLY, address(this));
    }

    /// @notice Allows users to purchase PaintTokens by sending ETH
    /// @param amount The number of PaintTokens to purchase (without decimals)
    function buyPaintTokens(uint256 amount) public payable nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        uint256 totalPrice = PAINT_TOKEN_PRICE * amount;
        require(msg.value >= totalPrice, "Insufficient ETH sent");

        // Transfer PaintTokens to the buyer
        paintToken.transfer(msg.sender, amount * DECIMALS);

        // Emit event for token purchase
        emit PaintTokensPurchased(msg.sender, amount * DECIMALS, totalPrice);

        // Refund excess ETH, if any
        if (msg.value > totalPrice) {
            (bool success, ) = msg.sender.call{value: msg.value - totalPrice}("");
            require(success, "Refund failed");
        }
    }

    /// @notice Retrieves the color of a specific pixel
    /// @param pixelId The ID of the pixel to retrieve
    /// @return The Pixel struct containing the color
    function getPixel(uint256 pixelId) public view returns (Pixel memory) {
        require(pixelId < TOTAL_PIXELS, "Invalid pixel ID");
        Pixel memory pixel = pixels[pixelId];
        if (pixel.color == 0) {
            pixel.color = 0x000000; // Default color (black) if not set
        }
        return pixel;
    }

    /// @notice Returns an array of all pixel colors
    /// @return An array of pixel colors
    function getAllPixels() public view returns (uint256[] memory) {
        uint256[] memory allPixels = new uint256[](TOTAL_PIXELS);
        for (uint256 i = 0; i < TOTAL_PIXELS; i++) {
            allPixels[i] = pixels[i].color;
        }
        return allPixels;
    }
    /// @notice Allows the owner to withdraw all ETH from the contract
    function withdraw() public onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /// @notice Allows users to set pixel colors using run-length encoding with color palette
    /// @param packedData Format: Each run is 4 bytes
    /// @param packedColors Format: Each 32 bytes contains up to 8 colors (4 bytes each)
    function setPixelColorsRLEPalette(bytes calldata packedData, bytes calldata packedColors) public nonReentrant {
        require(packedData.length % 4 == 0, "Invalid data length");
        
        uint256 numColors = packedColors.length / 3;
        require(numColors <= 256, "Too many colors");

        // Unpack colors into memory array with explicit RGB order
        uint256[] memory colors = new uint256[](numColors);
        unchecked {
            for(uint256 i = 0; i < numColors; i++) {
                uint256 offset = i * 3;
                colors[i] = (uint24(uint8(packedColors[offset])) << 16) | 
                           (uint24(uint8(packedColors[offset + 1])) << 8) | 
                           uint24(uint8(packedColors[offset + 2]));
            }
        }

        // First pass: validate all runs
        uint256 totalPixels;
        unchecked {
            for(uint256 idx = 0; idx < packedData.length; idx += 4) {
                uint16 position = uint16(uint8(packedData[idx])) << 8 | 
                                 uint16(uint8(packedData[idx + 1]));
                uint8 length = uint8(packedData[idx + 2]);
                uint8 colorIndex = uint8(packedData[idx + 3]);
                
                require(colorIndex < numColors, "Invalid color index");
                require(position + length <= TOTAL_PIXELS, "Run exceeds canvas bounds");
                totalPixels += length;
            }
        }

        // Burn tokens
        uint256 requiredTokens = totalPixels * DECIMALS;
        require(paintToken.balanceOf(msg.sender) >= requiredTokens, "Insufficient Paint tokens");
        paintToken.burnFrom(msg.sender, requiredTokens);
        
        // Second pass: set pixels
        unchecked {
            for(uint256 idx = 0; idx < packedData.length; idx += 4) {
                uint16 position = uint16(uint8(packedData[idx])) << 8 | 
                                 uint16(uint8(packedData[idx + 1]));
                uint8 length = uint8(packedData[idx + 2]);
                uint8 colorIndex = uint8(packedData[idx + 3]);
                uint24 color = uint24(colors[colorIndex]);
                
                for (uint8 j = 0; j < length; j++) {
                    pixels[position + j].color = color;
                    emit PixelChanged(position + j, color);
                }
            }
        }
    }

    /// @notice Set pixels in rectangular areas with compact encoding
    /// @param packedData Format: Each area is 7 bytes:
    /// - 1 byte: x coordinate
    /// - 1 byte: y coordinate
    /// - 1 byte: width
    /// - 1 byte: height
    /// - 3 bytes: color
    function setPixelAreasCompact(bytes calldata packedData) public nonReentrant {
        require(packedData.length % 7 == 0, "Invalid data length");
        uint256 totalAreas = packedData.length / 7;
        
        uint256 totalPixels = 0;
        
        // First pass: validate and count
        for (uint256 areaIdx = 0; areaIdx < totalAreas; areaIdx++) {
            uint256 offset = areaIdx * 7;
            uint256 x = uint8(packedData[offset]);
            uint256 y = uint8(packedData[offset + 1]);
            uint256 width = uint8(packedData[offset + 2]);
            uint256 height = uint8(packedData[offset + 3]);
            uint256 color = uint24(bytes3(packedData[offset + 4:offset + 7]));
            
            require(x + width <= CANVAS_WIDTH, "Area exceeds canvas width");
            require(y + height <= CANVAS_HEIGHT, "Area exceeds canvas height");
            require(color <= 0xFFFFFF, "Invalid color value");
            
            totalPixels += width * height;
            require(totalPixels <= TOTAL_PIXELS, "Too many pixels");
        }
        
        // Burn tokens
        uint256 requiredTokens = totalPixels * DECIMALS;
        require(paintToken.balanceOf(msg.sender) >= requiredTokens, "Insufficient Paint tokens");
        paintToken.burnFrom(msg.sender, requiredTokens);
        
        // Second pass: set pixels
        for (uint256 areaIdx = 0; areaIdx < totalAreas; areaIdx++) {
            uint256 offset = areaIdx * 7;
            uint256 x = uint8(packedData[offset]);
            uint256 y = uint8(packedData[offset + 1]);
            uint256 width = uint8(packedData[offset + 2]);
            uint256 height = uint8(packedData[offset + 3]);
            uint24 color = uint24(bytes3(packedData[offset + 4:offset + 7]));
            
            for (uint256 dy = 0; dy < height; dy++) {
                for (uint256 dx = 0; dx < width; dx++) {
                    uint256 pixelId = (y + dy) * CANVAS_WIDTH + (x + dx);
                    pixels[pixelId].color = color;
                    emit PixelChanged(pixelId, color);
                }
            }
        }
    }

    function setPixelColor(uint256 pixelId, uint256 color) internal {
        require(pixelId < TOTAL_PIXELS, "Invalid pixel ID");
        pixels[pixelId].color = uint24(color);
        emit PixelChanged(pixelId, color);
    }
}
