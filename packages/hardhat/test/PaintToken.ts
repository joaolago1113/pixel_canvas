import { expect } from 'chai';
import { ethers } from 'hardhat';
import { PaintToken } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('PaintToken', function () {
  let paintToken: PaintToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const decimals = 18;
    const totalSupply = ethers.parseUnits('1000000', decimals);

    const PaintTokenFactory = await ethers.getContractFactory('PaintToken');
    paintToken = (await PaintTokenFactory.deploy(totalSupply, owner.address)) as PaintToken;
    // No need to await deployed() in ethers v6
  });

  it('Should set the right owner', async function () {
    expect(await paintToken.owner()).to.equal(owner.address);
  });

  it('Should have correct initial supply', async function () {
    const totalSupply = ethers.parseUnits('1000000', await paintToken.decimals());
    expect(await paintToken.initialSupply()).to.equal(totalSupply);
    expect(await paintToken.totalSupply()).to.equal(totalSupply);
  });

  it('Should allow owner to burn tokens', async function () {
    const decimals = await paintToken.decimals();
    const amount = ethers.parseUnits('100', decimals);

    // Owner approves themselves
    await paintToken.connect(owner).approve(owner.address, amount);

    await paintToken.connect(owner).burnFrom(owner.address, amount);

    const balance = await paintToken.balanceOf(owner.address);
    const expectedBalance = ethers.parseUnits('999900', decimals);
    expect(balance).to.equal(expectedBalance);
  });

  it('Should not allow non-owner to burn tokens without approval', async function () {
    const decimals = await paintToken.decimals();
    const amount = ethers.parseUnits('100', decimals);

    await expect(paintToken.connect(addr1).burnFrom(owner.address, amount))
      .to.be.revertedWithCustomError(paintToken, 'ERC20InsufficientAllowance')
      .withArgs(addr1.address, 0n, amount);
  });
});
