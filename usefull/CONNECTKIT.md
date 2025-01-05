Getting Started
ConnectKit is the simplest way to integrate a connect wallet experience into your React.js web application. It comes with sensible defaults out of the box so you can focus on building.

1. Install
Install ConnectKit and its peer dependencies:

Terminal
npm install connectkit wagmi viem@2.x @tanstack/react-query
Wagmi is a React Hooks library for Ethereum, this is the library you will use to interact with the connected wallet.

Viem is a TypeScript interface for Ethereum that performs blockchain operations.

TanStack Query is an async state manager that handles requests, caching, and more.

TypeScript is optional, but highly recommended.

2. API Keys
ConnectKit utilises WalletConnect's SDK to help with connecting wallets. WalletConnect 2.0 requires a 
projectId
 which you can create quickly and easily for free over at WalletConnect Cloud.

3. Implementation
It is recommended to wrap your app within a new component that will help you set up ConnectKit and its dependencies.

Start by creating a new component called 
Web3Provider
. Here you will import the required providers and create a config using wagmi's 
createConfig
 method. ConnectKit supplies a pre-configured 
getDefaultConfig
 function to simplify the process of creating a config.

Below is a simple example app using 
getDefaultConfig()
 to help you get started:

When using a framework that supports React Server Components, you will need to include the 
"use client"
 directive at the beginning of this file.

Web3Provider.tsx
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [mainnet],
    transports: {
      // RPC URL for each chain
      [mainnet.id]: http(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`,
      ),
    },

    // Required API Keys
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,

    // Required App Info
    appName: "Your App Name",

    // Optional App Info
    appDescription: "Your App Description",
    appUrl: "https://family.co", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
Now that you have your 
Web3Provider
 component, you can wrap your app with it:

App.tsx
import { Web3Provider } from "./Web3Provider";
import { ConnectKitButton } from "connectkit";

const App = () => {
  return (
    <Web3Provider>
      <ConnectKitButton />
    </Web3Provider>
  );
};
And voilà, you've successfully set up ConnectKit.

4. Connected Wallet Info
In a lot of use cases, you will want to access the connected wallet from ConnectKit in order to be able to interact with it further. You can do so by using the different hooks, such as 
useAccount
, from wagmi (a ConnectKit dependency).

In the previous example above we wrapped our app with a 
<ConnectKitProvider>
 top-level. Before utilizing any wagmi hook, make sure the components you build are mounted under this provider.

Below is a simple example component that utilizes the 
useAccount
 hook to access connection state and the connected wallet address:

MyComponent.tsx
import { useAccount } from "wagmi";

// Make sure that this component is wrapped with ConnectKitProvider
const MyComponent = () => {
  const { address, isConnecting, isDisconnected } = useAccount();
  if (isConnecting) return <div>Connecting...</div>;
  if (isDisconnected) return <div>Disconnected</div>;
  return <div>Connected Wallet: {address}</div>;
};
That's it—you now have a simple component that displays the connected wallet's address.

Additional Build Tooling Setup
Some build tools require additional setup to work with ConnectKit.

Next.js
ConnectKit uses WalletConnect's SDK to help with connecting wallets. WalletConnect 2.0 pulls in Node.js dependencies that Next.js does not support by default.

You can mitigate this by adding the following to your 
next.config.js
 file:

next.config.js
module.exports = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};
Next.js App Router
If using Next.js App Router, or any framework that supports React Server Components, you will need to include the 
"use client"
 directive at the beginning of your 
Web3Provider
 file.

Web3Provider.tsx
"use client"

...

export const Web3Provider = ({ children }) => {
  return (
    ...
  );
};
Components
Below is a list of React.js components we provide as part of the library:

Component
Description
<ConnectKitProvider />
Provides state and data to various ConnectKit components. Wrap ConnectKitProvider around your React.js app.
<ConnectKitButton />
The ConnectKit button. Place this component where you’d like the Connect Wallet button to appear.
<ConnectKitButton.Custom />
Design your own Connect button. Various wallet connection states are provided through render props.
