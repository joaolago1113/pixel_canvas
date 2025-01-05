// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Import ERC20Burnable for burn functionality and Ownable for access control
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PaintToken
/// @notice ERC20 token used for purchasing pixels in the CollaborativeArtCanvas
contract PaintToken is ERC20Burnable, Ownable {
    uint256 public immutable initialSupply;

    /// @notice Constructor that mints the initial supply to the canvas contract and sets the owner
    /// @param _initialSupply The total supply of PaintToken
    /// @param canvasContract The address of the CollaborativeArtCanvas contract
    constructor(uint256 _initialSupply, address canvasContract)
        ERC20("Paint Token", "PAINT")
        Ownable(canvasContract)
    {
        initialSupply = _initialSupply;
        _mint(canvasContract, _initialSupply);
        // Ownership is set to canvasContract via the Ownable constructor
    }

    // Note: No public minting functions are exposed to prevent additional tokens from being minted
}
