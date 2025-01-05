Hardhat
Learn how to develop smart contracts on the Lens Network using Hardhat.

This guide is focused on Solidity Hardhat projects developed in TypeScript and utilizing ethers.js.

Migrate an Existing Project
In this section, we'll walk you through the process of migrating an existing Solidity Hardhat project to the Lens Network.

Compile Contracts
The first step in migrating an existing project to the Lens Network is to compile the contracts using the 
zksolc
 compiler.

1

Install Dependencies
Start by installing the 
@matterlabs/hardhat-zksync
 and 
zksync-ethers
 packages:

npm
yarn
npm install -D @matterlabs/hardhat-zksync zksync-ethers
2

Update hardhat.config.ts
Next, update your 
hardhat.config.ts
 file as follows:

Import the 
@matterlabs/hardhat-zksync
 plugin.

Configure the Hardhat Network for ZKsync compatibility.

Add the Lens Testnet network configuration.

Include the 
zksolc
 compiler options.

Example configuration:

hardhat.config.ts
import "@matterlabs/hardhat-zksync";
import "@nomicfoundation/hardhat-toolbox";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",

  zksolc: {
    version: "latest",
    settings: {},
  },

  networks: {
    // ...

    lensTestnet: {
      chainId: 37111,
      ethNetwork: "sepolia",
      url: "https://rpc.testnet.lens.dev",
      verifyURL:
        "https://block-explorer-verify.testnet.lens.dev/contract_verification",
      zksync: true,
    },

    hardhat: {
      zksync: true,
    },
  },
};

export default config;
In case of multiple networks configuration, remember to add 
zksync: false
 to any other networks.

3

Compile
Now you can compile the contracts using the 
zksolc
 compiler:

npm
yarn
npm hardhat compile
This command will compile all contracts in the 
/contracts
 folder and create the folders 
artifacts-zk
 and 
cache-zk
.

Include the 
artifacts-zk
 and 
cache-zk
 in your 
.gitignore
 file alongside the typical Hardhat 
artifacts
 and 
cache
 folders.

Upon successful compilation, you will receive an output similar to the following:

Compiling contracts for ZKsync Era with zksolc v1.5.1 and zkvm-solc v0.8.24-1.0.1
Compiling 15 Solidity files
Generating typings for: 16 artifacts in dir: typechain-types for target: ethers-v6
Successfully generated 52 typings!
Successfully compiled 15 Solidity files
Deploy Contracts
With the contracts compiled, it's time to deploy them to the Lens Network. A simple contract example will guide us through the deployment process.

contracts/Storage.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Storage {
    // This variable will store the number
    uint256 private storedNumber;

    // This event will be emitted whenever the stored number is updated
    event NumberStored(uint256 newNumber);

    // Constructor to initialize the stored number
    constructor(uint256 initialNumber) {
        storedNumber = initialNumber;
        emit NumberStored(initialNumber);
    }

    // Function to store a new number
    function storeNumber(uint256 newNumber) public {
        storedNumber = newNumber;
        emit NumberStored(newNumber);
    }

    // Function to retrieve the stored number
    function retrieveNumber() public view returns (uint256) {
        return storedNumber;
    }
}
1

Setup Deployment Wallet
To deploy contracts on the Lens Network, you'll need $GRASS tokens. Ask the Lens Team for testnet tokens.

In a Hardhat Network development environment, you can bypass this requirement by using pre-configured rich wallets.

2

Deploy Script
Contract deployment varies slightly depending on whether you deploy a regular contract or an upgradeable contract.

Regular Contract
Upgradable Transparent Proxy
Within the 
deploy
 folder, create a deployment script using the 
Deployer
 class from the 
@matterlabs/hardhat-zksync
 plugin, as illustrated below:

deploy/deploy-storage.ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  // Initialize the wallet.
  const wallet = new Wallet("<WALLET-PRIVATE-KEY>");

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  // Load contract
  const artifact = await deployer.loadArtifact("Storage");

  // `initialNumber` is an argument for contract constructor.
  const initialNumber = 42;
  const greeterContract = await deployer.deploy(artifact, [initialNumber]);

  // Show the contract info.
  console.log(
    `${
      artifact.contractName
    } was deployed to ${await greeterContract.getAddress()}`
  );
}
Run the 
deploy-zksync
 task specifying the script and the network:

npm
yarn
npm hardhat deploy-zksync --script deploy-storage.ts --network lensTestnet
Upon successful deployment of the contract you will receive an output similar to the following:

Running deploy script
Storage was deployed to 0xda2BFD327d880A42Ec72E3392E10e43bb32B874F
Keep note of the contract address as it will be required for verification.

3

Verify Contracts
Once the contract is deployed, you can verify it on the Lens Network with the 
hardhat verify
 command. Note that the verification process differs slightly between regular and upgradeable contracts.

Regular Contract
Upgradable Transparent Proxy
Verify the contract specifying the contract address and any constructor arguments:

npm
yarn
# npm hardhat verify <CONTRACT-ADDRESS> [<constructor-args>] --network lensTestnet
npm hardhat verify 0xda2BFD327d880A42Ec72E3392E10e43bb32B874F "42" --network lensTestnet
Upon successful verification, you will receive an output similar to the following:

lensTestnet Your verification ID is: 70 Contract successfully verified on
ZKsync block explorer!
That's it—you've successfully deployed and verified a contract on the Lens Network.

Create a New Project
For those beginning a new project, the Hardhat boilerplate tailored for the Lens Network is highly recommended. It offers a foundational setup for efficiently deploying and testing smart contracts on the Lens Network.

Included in the boilerplate are:

/contracts
: A sample smart contract.

/deploy
: Scripts for deploying contracts.

/test
: Examples of tests for your contracts.

hardhat.config.ts
: A Hardhat configuration file customized for the Lens Network.

Getting Started
Make sure you have the Node.js >= v20.

If you use nvm to manage your Node.js versions, you can run 
nvm use
 from within the project directory to switch to the correct Node.js version.

Enable Corepack, if it isn't already; this will allow you to use the correct Yarn version:

corepack enable
Then, follow these steps to get started:

1

Clone the Repository
Clone the boilerplate repository into a new project directory:

git clone https://github.com/lens-network/hardhat-boilerplate.git my-project
cd my-project
2

Install Dependencies
Install the project dependencies:

yarn install
3

Setup Environment
Create 
.env
 file from the 
.env.example
 template:

cp .env.example .env
and populate the 
PRIVATE_KEY
 environment variable:

.env
PRIVATE_KEY=0x…
with the private key of an account with Lens Network tokens.

Use network facuets to obtain tokens for testing.

Usage
The project includes several yarn scripts designed to streamline your workflow:

yarn compile
: Compiles the contracts.

yarn deploy --script <your-deploy-script.ts> --network lensTestnet
: Deploys and verifies contracts.

yarn test
: Executes tests against local ZKsync node.

yarn clean
: Removes build artifacts from the project.

yarn lint
: Lints the Solidity code.

For detailed instructions on how to utilize these scripts, refer to the project's 
README.md
 file.

Utils
The 
deploy/utils.ts
 file contains helper functions for deploying contracts. You can use these functions to streamline the deployment process.

deployContract(contractName, constructorArgs, options)
To deploy regular contracts, you can use the 
deployContract
 helper as demonstrated below:

deploy/deploy-contract.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deployTransparentProxy, getWallet } from "./utils";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = getWallet();

  await deployTransparentProxy(
    "<CONTRACT_NAME>",
    [
      /* Constructor arguments */
    ],
    {
      hre,
      wallet,
      verify: true,
    }
  );
}
deployTransparentProxy(contractName, initializationArgs, options)
To deploy upgradeable contracts, you can use the 
deployTransparentProxy
 helper as demonstrated below:

deploy/deploy-my-upgradeable-contract.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deployTransparentProxy, getWallet } from "./utils";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = getWallet();

  await deployTransparentProxy(
    "<CONTRACT_NAME>",
    [
      /** Initialization arguments */
    ],
    {
      hre,
      wallet,
      verify: true,
    }
  );
}
Troubleshooting
Failed Deployment
This issue should not impact projects created using the Hardhat boilerplate.

If gas estimation for the deployment of an upgradeable contract fails immediately after deploying the implementation and admin contracts, like so:

Implementation contract was deployed to 0xCCa917109e1fCF7c41f32912b09e9Ee67b1B64D5
Admin was deployed to 0x0D859C0987d2374Bc1E41e6eF51e56517C2Fa2dE
An unexpected error occurred:

Error: missing revert data (action="estimateGas", data=null, reason=null, transaction={ "data": "0x9c4d535b000000000000000000…"
This issue often arises from using an incompatible version of OpenZeppelin contracts. To resolve this issue, ensure you are using the correct versions:

package.json
"@openzeppelin/contracts": "^4.9.6",
"@openzeppelin/contracts-upgradeable": "^4.9.6",
For further details, refer to the ZKsync documentation.

Intermittend Test Failures
This issue should not impact projects created using the Hardhat boilerplate.

If you experience intermittent test failures when running against the Hardhat network, such as:

Error: No contract at address 0x111C3E89Ce80e62EE88318C2804920D4c96f92bb (Removed from manifest)
  at validateStoredDeployment (node_modules/@openzeppelin/upgrades-core/src/deployment.ts:153:13)
  at processTicksAndRejections (node:internal/process/task_queues:95:5)
  at async validateCached (node_modules/@openzeppelin/upgrades-core/src/deployment.ts:95:14)
  at async resumeOrDeploy (node_modules/@openzeppelin/upgrades-core/src/deployment.ts:74:21)
  at async /path/to/your/project/repo/node_modules/@matterlabs/hardhat-zksync-upgradable/src/core/impl-store.ts:49:29
  at async Manifest.lockedRun (node_modules/@matterlabs/hardhat-zksync-upgradable/src/core/manifest.ts:150:20)
  at async fetchOrDeployGeneric (node_modules/@matterlabs/hardhat-zksync-upgradable/src/core/impl-store.ts:39:28)
  at async deployImpl (node_modules/@matterlabs/hardhat-zksync-upgradable/src/proxy-deployment/deploy-impl.ts:74:24)
  at async deployProxyImpl (node_modules/@matterlabs/hardhat-zksync-upgradable/src/proxy-deployment/deploy-impl.ts:63:12)
  at async Proxy.deployProxy (node_modules/@matterlabs/hardhat-zksync-upgradable/src/proxy-deployment/deploy-proxy.ts:50:32)
This issue is related to a file generated by the 
@matterlabs/hardhat-zksync-upgradable
 plugin, part of the 
@matterlabs/hardhat-zksync
 package. A workaround involves deleting the file

./.upgradable/ZKsync-era-test-node.json
before running tests.

To streamline this process, incorporate the following scripts into your 
package.json
:

package.json
"scripts": {
  "clean:upgradable": "rimraf ./.upgradable/ZKsync-era-test-node.json",
  "test": "yarn clean:upgradable && hardhat test"
},
Additionally, add this line to your 
.gitignore
:

.gitignore
# ZKsync files
.upgradable/ZKsync-era-test-node.json
It's advisable to keep the other files in the 
.upgradable
 directory version-controlled to facilitate seamless contract upgrades on the Lens Network.

Task Redefinition Failed
This issue should not impact projects created using the Hardhat boilerplate.

If you encounter the error below while running 
yarn hardhat test
:

Error HH209: Redefinition of task verify:etherscan failed. Unsupported operation adding mandatory (non optional) param definitions in an overridden task.

For more info go to https://hardhat.org/HH209 or run Hardhat with --show-stack-traces
This issue is often caused by Yarn Plug'n'Play (PnP) installation strategy and can be resolved by modifying your 
.yarnrc.yml
 file as follows:

.yarnrc.yml
nodeLinker: node-modules
Delete the following files:

.pnp.cjs
.pnp.loader.mjs
Optionally: adding the following to your 
.gitignore
 file:

.gitignore
#!.yarn/cache
.pnp.*
and then running 
yarn install
 again.

No Gas Amount Specified
If you are migrating a project that involves sending or transferring native tokens (e.g. Ether on Mainnet, Matic on Polygon, etc.), you are likely to encounter the following error:

Compilation Error
Error: You are using '<address payable>.send/transfer(<X>)' without providing the gas amount.
Such calls will fail depending on the pubdata costs.

Please use 'payable(<address>).call{value: <X>}("")' instead, but be careful with the
reentrancy attack. `send` and `transfer` send limited amount of gas that prevents reentrancy,
whereas `<address>.call{value: <X>}` sends all gas to the callee.

Learn more about reentrancy at https://docs.soliditylang.org/en/latest/security-considerations.html#reentrancy

You may disable this error with:
    1. `suppressedErrors = ["sendtransfer"]` in standard JSON.
    2. `--suppress-errors sendtransfer` in the CLI.
   --> contracts/Lock.sol:26:7
    |
 26 |         owner.transfer(address(this).balance);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^


Error HH600: Compilation failed
When dealing with transactions that send or transfer native tokens, avoid using the following patterns:

AVOID
payable(addr).send(x) // or
payable(addr).transfer(x)
These methods may not provide sufficient gas for calls that involve state changes requiring significant L2 gas for data processing.

Instead, opt for the 
call
 method as shown below:

GOOD
(bool success, ) = addr.call{value: msg.value}("");
require(success, "Transfer failed.");
This approach is more reliable for ensuring transactions are processed successfully. For further details, see the ZKsync best practices.