import { http } from "viem";
import { createConfig } from "wagmi";
import { NETWORKS } from "~/constants/contracts";

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

export const wagmiConfig = createConfig({
  chains: [//localChain, 
          lensChain],
  transports: {
    [localChain.id]: http("http://127.0.0.1:8545"),
    [lensChain.id]: http(NETWORKS.LENS.rpcUrl),
  },
}); 