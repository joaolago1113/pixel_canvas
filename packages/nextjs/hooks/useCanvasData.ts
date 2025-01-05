import { useEffect, useState, useRef } from "react";
import { useReadContract } from "wagmi";
import { CONTRACTS, CANVAS_ABI } from "~/constants/contracts";

export function useCanvasData() {
  const [totalPixelsPainted, setTotalPixelsPainted] = useState<number>(0);
  const [pixelOwners, setPixelOwners] = useState<{ [key: number]: { color: number } }>({});
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const retryCountRef = useRef(0);
  const maxRetries = 10;

  const { data: pixels, isError, error: contractError, refetch, isLoading: isContractLoading } = useReadContract({
    address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
    abi: CANVAS_ABI,
    functionName: "getAllPixels",
  }) as { 
    data: bigint[]; 
    isError: boolean; 
    error: Error | null;
    refetch: () => Promise<any>;
    isLoading: boolean;
  };

  useEffect(() => {
    const retryInterval = 2000;

    const attemptFetch = () => {
      if (!isInitialized && retryCountRef.current < maxRetries) {
        console.log(`[Canvas] Retry ${retryCountRef.current + 1}/${maxRetries}, Pixels: ${!!pixels}, Error: ${!!isError}`);
        
        const timer = setTimeout(() => {
          retryCountRef.current += 1;
          refetch();
        }, retryInterval);
        
        return () => clearTimeout(timer);
      }
    };

    return attemptFetch();
  }, [pixels, isError, refetch, isInitialized]);

  useEffect(() => {
    if (isError) {
      console.error("[Canvas] Error fetching canvas data:", contractError);
      setError(contractError || new Error("Failed to fetch canvas data"));
      return;
    }

    if (!pixels) {
      console.log("[Canvas] No pixel data available yet");
      return;
    }

    try {
      console.log("[Canvas] Processing pixel data, length:", pixels.length);
      const owners: { [key: number]: { color: number } } = {};
      let paintedCount = 0;

      pixels.forEach((pixel, index) => {
        if (pixel !== BigInt(0)) {
          const colorValue = Number(pixel);
          owners[index] = { color: colorValue };
          paintedCount++;
        }
      });

      console.log("[Canvas] Processed pixels:", {
        total: pixels.length,
        painted: paintedCount,
        ownersSize: Object.keys(owners).length
      });

      setPixelOwners(owners);
      setTotalPixelsPainted(paintedCount);
      setError(null);
      setIsInitialized(true);
      console.log("[Canvas] Data initialization complete");
    } catch (err) {
      console.error("[Canvas] Error processing pixel data:", err);
      setError(err instanceof Error ? err : new Error("Failed to process pixel data"));
    }
  }, [pixels, isError, contractError]);

  useEffect(() => {
    console.log("[Canvas] State update:", {
      hasPixels: !!pixels,
      pixelOwnersCount: Object.keys(pixelOwners).length,
      isLoading: (!pixels && !isError) || !isInitialized || isContractLoading,
      hasError: !!error,
      isInitialized
    });
  }, [pixels, pixelOwners, error, isInitialized, isContractLoading, isError]);

  return {
    totalPixelsPainted,
    pixelOwners,
    isLoading: (!pixels && !isError) || !isInitialized || isContractLoading,
    error,
    refetch,
    isInitialized
  };
} 