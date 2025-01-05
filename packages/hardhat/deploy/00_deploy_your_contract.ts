import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "@matterlabs/hardhat-zksync/node_modules/zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {

  const PRIVATE_KEY = `0x${process.env.DEPLOYER_PRIVATE_KEY}`;
  // Use the first account from the local node
  const wallet = new Wallet(PRIVATE_KEY) as any;

  // Create deployer object and load the artifact of the contracts we want to deploy
  const deployer = new Deployer(hre, wallet);

  // Load contract artifacts
  const collaborativeArtCanvasArtifact = await deployer.loadArtifact("CollaborativeArtCanvas");

  // Deploy the CollaborativeArtCanvas contract
  const collaborativeArtCanvas = await deployer.deploy(collaborativeArtCanvasArtifact, [wallet.address]);
  console.log("CollaborativeArtCanvas deployed to:", await collaborativeArtCanvas.getAddress());

  // Get the PaintToken contract address created by CollaborativeArtCanvas
  const paintTokenAddress = await collaborativeArtCanvas.paintToken();
  console.log("PaintToken deployed by CollaborativeArtCanvas:", paintTokenAddress);
}
