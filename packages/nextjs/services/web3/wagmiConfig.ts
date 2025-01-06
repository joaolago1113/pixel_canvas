import { http } from "viem";
import { createConfig } from "wagmi";
import { NETWORKS } from "~/constants/contracts";
import { getDefaultConfig } from "connectkit";

// Define the local network chain
const localChain = {
  id: 260,
  name: "zkSync Era Local",
  network: "zksync-local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
    public: {
      http: ["http://127.0.0.1:8545"],
    },
  },
};

// Define the Lens Network chain
const lensChain = {
  id: NETWORKS.LENS.id,
  name: NETWORKS.LENS.name,
  network: "lens-testnet",
  nativeCurrency: NETWORKS.LENS.nativeCurrency,
  rpcUrls: {
    default: {
      http: [NETWORKS.LENS.rpcUrl],
    },
    public: {
      http: [NETWORKS.LENS.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Lens Explorer",
      url: NETWORKS.LENS.blockExplorer,
    },
  },
};

export const wagmiConfig = createConfig(
  getDefaultConfig({
    // Your dApp's info
    appName: "Pixel Canvas",
    appDescription: "A collaborative pixel art canvas on the blockchain",
    appUrl: "https://pixelcanvas.vercel.app",
    appIcon: "https://pixelcanvas.vercel.app/logo.svg",

    // Chains
    chains: [lensChain],
    transports: {
      [lensChain.id]: http(NETWORKS.LENS.rpcUrl),
    },

    // Wallets config
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  }),
); 