import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CollaborativeArtCanvas, PaintToken } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('CollaborativeArtCanvas', function () {
  let collaborativeArtCanvas: CollaborativeArtCanvas;
  let paintToken: PaintToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const CollaborativeArtCanvasFactory = await ethers.getContractFactory('CollaborativeArtCanvas');
    collaborativeArtCanvas = (await CollaborativeArtCanvasFactory.deploy(owner.address)) as CollaborativeArtCanvas;
    // No need to wait for deployment in ethers v6

    const paintTokenAddress = await collaborativeArtCanvas.paintToken();
    paintToken = (await ethers.getContractAt('PaintToken', paintTokenAddress)) as PaintToken;
  });

  it('Should set the right owner', async function () {
    expect(await collaborativeArtCanvas.owner()).to.equal(owner.address);
  });

  it('Should have correct canvas dimensions', async function () {
    expect(await collaborativeArtCanvas.CANVAS_WIDTH()).to.equal(64);
    expect(await collaborativeArtCanvas.CANVAS_HEIGHT()).to.equal(64);
    expect(await collaborativeArtCanvas.TOTAL_PIXELS()).to.equal(4096);
  });

  it('Should allow setting multiple pixel colors', async function () {
    const pixelIds = [0, 1, 2];
    const colors = [0xff0000, 0x00ff00, 0x0000ff];

    const amount = pixelIds.length; // Need one token per pixel
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);

    // addr1 buys PaintTokens
    await collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice });

    // addr1 approves the canvas contract to burn tokens
    const decimals = await paintToken.decimals();
    const requiredTokens = BigInt(amount) * BigInt(10) ** BigInt(decimals);
    await paintToken.connect(addr1).approve(await collaborativeArtCanvas.getAddress(), requiredTokens);

    await expect(collaborativeArtCanvas.connect(addr1).setPixelColors(pixelIds, colors))
      .to.emit(collaborativeArtCanvas, 'PixelChanged')
      .withArgs(pixelIds[0], colors[0])
      .and.to.emit(collaborativeArtCanvas, 'PixelChanged')
      .withArgs(pixelIds[1], colors[1])
      .and.to.emit(collaborativeArtCanvas, 'PixelChanged')
      .withArgs(pixelIds[2], colors[2]);

    // Check colors
    for (let i = 0; i < pixelIds.length; i++) {
      const pixel = await collaborativeArtCanvas.getPixel(pixelIds[i]);
      expect(pixel.color).to.equal(colors[i]);
    }
  });

  it('Should not allow setting colors for invalid pixel IDs', async function () {
    const invalidPixelId = 4096; // Total pixels is 1024, so this is out of bounds
    const colors = [0xff0000];
    const amount = 1;
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);

    // addr1 buys PaintTokens
    await collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice });

    // addr1 approves the canvas contract to burn tokens
    const decimals = await paintToken.decimals();
    const requiredTokens = BigInt(amount) * BigInt(10) ** BigInt(decimals);
    await paintToken.connect(addr1).approve(await collaborativeArtCanvas.getAddress(), requiredTokens);

    await expect(
      collaborativeArtCanvas.connect(addr1).setPixelColors([invalidPixelId], colors),
    ).to.be.revertedWith('Invalid pixel ID');
  });

  it('Should revert when array lengths don\'t match', async function () {
    const pixelIds = [0, 1];
    const colors = [0xff0000];
    const amount = pixelIds.length;
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);

    // addr1 buys PaintTokens
    await collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice });

    // addr1 approves the canvas contract to burn tokens
    const decimals = await paintToken.decimals();
    const requiredTokens = BigInt(amount) * BigInt(10) ** BigInt(decimals);
    await paintToken.connect(addr1).approve(await collaborativeArtCanvas.getAddress(), requiredTokens);

    await expect(
      collaborativeArtCanvas.connect(addr1).setPixelColors(pixelIds, colors),
    ).to.be.revertedWith('Mismatched array lengths');
  });

  it('Should allow buying paint tokens', async function () {
    const amount = 100;
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);
    const decimals = await paintToken.decimals();
    const amountWithDecimals = BigInt(amount) * BigInt(10) ** BigInt(decimals);

    await expect(
      collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice }),
    )
      .to.emit(paintToken, 'Transfer')
      .withArgs(await collaborativeArtCanvas.getAddress(), addr1.address, amountWithDecimals);

    expect(await paintToken.balanceOf(addr1.address)).to.equal(amountWithDecimals);
  });

  it('Should not allow buying paint tokens with insufficient payment', async function () {
    const amount = 100;
    const insufficientPrice = ethers.parseEther('0.002'); // Less than required
    await expect(
      collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: insufficientPrice }),
    ).to.be.revertedWith('Insufficient ETH sent');
  });

  it('Should burn paint tokens when painting pixels', async function () {
    const pixelIds = [0, 1, 2];
    const colors = [0xFF0000, 0x00FF00, 0x0000FF];
    const amount = pixelIds.length;
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);
    const decimals = await paintToken.decimals();
    const amountWithDecimals = BigInt(amount) * BigInt(10) ** BigInt(decimals);

    // addr1 buys PaintTokens
    await collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice });

    // addr1 approves the canvas contract to burn tokens
    await paintToken.connect(addr1).approve(await collaborativeArtCanvas.getAddress(), amountWithDecimals);

    await expect(collaborativeArtCanvas.connect(addr1).setPixelColors(pixelIds, colors))
      .to.emit(paintToken, 'Transfer')
      .withArgs(addr1.address, ethers.ZeroAddress, amountWithDecimals);

    expect(await paintToken.balanceOf(addr1.address)).to.equal(0n);
  });

  it('Should transfer paint tokens to the caller when buying paint tokens', async function () {
    const amount = 100;
    const totalPrice = ethers.parseEther('0.00003') * BigInt(amount);
    const decimals = await paintToken.decimals();
    const amountWithDecimals = BigInt(amount) * BigInt(10) ** BigInt(decimals);

    const initialBalance = await paintToken.balanceOf(addr1.address);

    await expect(
      collaborativeArtCanvas.connect(addr1).buyPaintTokens(amount, { value: totalPrice }),
    )
      .to.emit(paintToken, 'Transfer')
      .withArgs(await collaborativeArtCanvas.getAddress(), addr1.address, amountWithDecimals);

    const finalBalance = await paintToken.balanceOf(addr1.address);
    expect(finalBalance).to.equal(BigInt(initialBalance) + (amountWithDecimals));
  });
});
