import CollaborativeArtCanvasArtifact from "./abis/CollaborativeArtCanvas.json";
import PaintTokenArtifact from "./abis/PaintToken.json";

// Add validation to ensure addresses are checksummed and properly typed
const validateAddress = (address: string): `0x${string}` => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid address format: ${address}`);
  }
  return address as `0x${string}`;
};

export const CONTRACTS = {
  COLLABORATIVE_ART_CANVAS: validateAddress("0xDdC944c362A3D3b8B2223092Fab0027DF127ae27"),
  PAINT_TOKEN: validateAddress("0x1e952234E4014B836FfA8877b26Cb61fF206926e")
} as const;

export const PAINT_TOKEN_ABI = PaintTokenArtifact.abi;
export const CANVAS_ABI = CollaborativeArtCanvasArtifact.abi;

// Contract Constants
export const TOKEN_CONSTANTS = {
  PAINT_TOKEN_PRICE_GWEI: BigInt(250), // 30,000 gwei in wei
  TOKEN_DECIMALS: BigInt(10 ** 18),
} as const;

export const NETWORKS = {
  LENS: {
    name: "Lens Network Sepolia Testnet",
    id: 37111,
    rpcUrl: "https://rpc.testnet.lens.dev",
    blockExplorer: "https://block-explorer.testnet.lens.dev",
    nativeCurrency: {
      name: "GRASS",
      symbol: "GRASS",
      decimals: 18
    }
  },
  // LOCAL: {
  //   id: 260,
  //   name: "zkSync Era Local",
  //   rpcUrl: "http://127.0.0.1:8545",
  // },
} as const; 