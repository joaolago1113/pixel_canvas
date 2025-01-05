Ethers SDK
Interact with the Lens Network using ethers.js.

The Lens Network SDK provides support for ethers.js, a widely-used JavaScript library for interacting with EVM blockchains. This is achieved by building upon ZKsync-ethers v6, the official ZKsync SDK for ethers.js.

This section assumes you are familiar with the ethers concepts of Provider and Signer:

A Provider is a read-only connection to the blockchain, which allows querying the blockchain state, such as account, block or transaction details, querying event logs or evaluating read-only code using call.

A Signer wraps all operations that interact with an account. An account generally has a private key located somewhere, which can be used to sign a variety of types of payloads.

Getting Started
1

Install ZKsync-ethers
First, install ZKsync-ethers package:

npm
yarn
pnpm
npm install zksync-ethers ethers@6
ethers.js version 6 is a peer dependency of 
zksync-ethers
 package. Make sure to install it alongside ZKsync-ethers.

2

Install SDK
Then, install the 
@lens-network/sdk
 package:

npm
yarn
pnpm
npm install @lens-network/sdk@canary
3

Create Your Providers
Next, create the providers to interact with the Lens Network and the corresponding L1 (an Ethereum chain):

JsonRpcProvider
BrowserProvider
To interact with the Lens Network, use the SDK's 
getDefaultProvider
 function. This creates a specialized JsonRpcProvider instance that supports the 
lens
 and 
zks
 RPC method namespaces.

For interactions with Ethereum L1, create an ethers Provider connected to the corresponding network (Sepolia for testnets). The example below uses the getDefaultProvider function from the 
ethers
 package.

providers.ts
import { getDefaultProvider, Network } from "@lens-network/sdk/ethers";
import { ethers } from "ethers";

// Lens Network (L2)
export const lensProvider = getDefaultProvider(Network.Testnet);

// Ethereum L1
export const ethProvider = ethers.getDefaultProvider("sepolia");
Create a Signer
Lens Network leverages ZKsync-ethers signers to facilitate interaction with an account. Below a list of available signers:

The Wallet class extends ethers.Wallet, incorporating additional ZKsync features.

The EIP712Signer class is used to sign EIP712-typed ZKsync transactions.

The Signer and L1Signer classes are designed for browser integration.

The SmartAccount class enhances support for account abstraction. It includes factory classes such as:
ECDSASmartAccount, which uses a single ECDSA key for signing payloads.

MultisigECDSASmartAccount, which uses multiple ECDSA keys for signing payloads.

Additionally, ZKsync-ether includes 
VoidSigner
 and 
L1VoidSigner
 classes. These are ZKsync's implementations of ethers' VoidSigner. They allow an address to be used in any API that accepts a Signer, even when no credentials are available for actual signing.

ZKsync Signers
import {
  Wallet,
  EIP712Signer,
  Signer,
  SmartAccount,
  ECDSASmartAccount,
  MultisigECDSASmartAccount,
} from "zksync-ethers";
For a subset of these, the SDK provides extended versions that include Lens Network-specific features.

Lens Network Signers
import { Wallet, Signer } from "@lens-network/sdk/ethers";
Wallet
Create a 
Wallet
 instance using the L1 and/or L2 providers depending on which network you want to interact with.

wallet.ts
providers.ts
import { Wallet } from "@lens-network/sdk/ethers";

import { lensProvider, ethProvider } from "./providers";

export const wallet = new Wallet(
  process.env.PRIVATE_KEY as String,
  lensProvider,
  ethProvider
);
You can also create an unconnected 
Wallet
 instance and connect it later:

wallet.ts
providers.ts
import { Wallet } from "@lens-network/sdk/ethers";

import { lensProvider, ethProvider } from "./providers";

const unconnectedWallet = new Wallet(process.env.PRIVATE_KEY as String);

const lensWallet = unconnectedWallet.connect(lensProvider);

const ethWallet = unconnectedWallet.connectToL1(ethProvider);
Signer
Create a 
Signer
 instance that is connected to the 
BrowserProvider
 instance.

This class is to be used in a browser environment.

signer.ts
providers.ts
import { Signer } from "@lens-network/sdk/ethers";

import { browserProvider, lensProvider } from "./providers";

const network = await browserProvider.getNetwork();

const signer = Signer.from(
  await browserProvider.getSigner(),
  Number(network.chainId),
  lensProvider
);
L1Signer
Create an 
L1Signer
 instance to do ZKsync-related operations on L1. To do so you need to connect it to both the 
BrowserProvider
 and the 
LensProvider
.

This class is to be used in a browser environment.

l1Signer.ts
providers.ts
import { L1Signer } from "zksync-ethers";

import { browserProvider, lensProvider } from "./providers";

export const l1Signer = L1Signer.from(
  await browserProvider.getSigner(),
  lensProvider
);
Additional Options
Custom RPC Node
If you want to use a Lens Network RPC node other than the default one, you can create a custom provider like this:

providers.ts
import { Provider } from "@lens-network/sdk/ethers";

// Lens Network (L2)
export const lensProvider = new Provider("https://custom-rpc-node.com");