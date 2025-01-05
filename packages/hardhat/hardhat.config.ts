import "@matterlabs/hardhat-zksync";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import dotenv from 'dotenv';

import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",

  namedAccounts: {
    deployer: {
      default: 0, // First account
    },
  },

  networks: {
    hardhat: {
      zksync: true,
      chainId: 260,
    },
    localhost: {
      zksync: true,
      chainId: 260,
      ethNetwork: "http://localhost:8545",
      url: "http://127.0.0.1:8545",
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" // First private key from the list
      ],
    },
    lensTestnet: {
      zksync: true,
      chainId: 37111,
      ethNetwork: "sepolia",
      url: "https://rpc.testnet.lens.dev",
      verifyURL: "https://block-explorer-verify.testnet.lens.dev/contract_verification",
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
    },
  },
};

export default config;