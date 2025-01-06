"use client";

import { ReactNode } from "react";
import { ConnectKitProvider } from "connectkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "~/services/web3/wagmiConfig";
import { NETWORKS } from "@/constants/contracts";

const queryClient = new QueryClient();

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            "--ck-font-family": '"Inter", sans-serif',
            "--ck-border-radius": "12px",
            "--ck-overlay-backdrop-filter": "blur(8px)",
          }}
          mode="dark"
          options={{
            hideBalance: false,
            hideNoWalletCTA: true,
            walletConnectName: "WalletConnect",
            initialChainId: NETWORKS.LENS.id,
            enforceSupportedChains: false,
            embedGoogleFonts: true,
            walletConnectCTA: "both"
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 