import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { CONTRACTS, CANVAS_ABI } from "~/constants/contracts";

export function useCanvasData() {
  const [canvasPixels, setCanvasPixels] = useState<{ [key: number]: { color: number } }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Separate dimension queries
  const { data: canvasWidth } = useReadContract({
    address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
    abi: CANVAS_ABI,
    functionName: "CANVAS_WIDTH",
  });

  const { data: canvasHeight } = useReadContract({
    address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
    abi: CANVAS_ABI,
    functionName: "CANVAS_HEIGHT",
  });

  const { data: pixels, isError, isLoading: isContractLoading } = useReadContract({
    address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
    abi: CANVAS_ABI,
    functionName: "getAllPixels",
  }) as { data: bigint[] | undefined; isError: boolean; isLoading: boolean };

  useEffect(() => {
    const processPixels = async () => {
      try {
        if (!pixels || !canvasWidth || !canvasHeight) {
          console.log("[useCanvasData] Waiting for data...", { 
            hasPixels: !!pixels, 
            hasWidth: !!canvasWidth, 
            hasHeight: !!canvasHeight 
          });
          return;
        }

        const processedPixels: { [key: number]: { color: number } } = {};
        pixels.forEach((color, index) => {
          if (color > 0) {
            processedPixels[index] = { color: Number(color) };
          }
        });

        setCanvasPixels(processedPixels);
        setIsLoading(false);
      } catch (err) {
        console.error("[useCanvasData] Error processing pixels:", err);
        setError(err instanceof Error ? err : new Error("Failed to process pixels"));
        setIsLoading(false);
      }
    };

    processPixels();
  }, [pixels, canvasWidth, canvasHeight]);

  return {
    canvasPixels,
    canvasWidth: canvasWidth ? Number(canvasWidth) : undefined,
    canvasHeight: canvasHeight ? Number(canvasHeight) : undefined,
    isLoading: isLoading || isContractLoading || !canvasWidth || !canvasHeight,
    error: error || (isError ? new Error("Failed to fetch data") : null)
  };
} 