"use client";

import { ReactNode } from "react";
import { ConnectKitProvider } from "connectkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "~/services/web3/wagmiConfig";

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
            initialChainId: 260,
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 