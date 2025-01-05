import { useCallback } from "react";
import { useAccount, useWriteContract, useReadContract, usePublicClient } from "wagmi";
import { CONTRACTS, PAINT_TOKEN_ABI, CANVAS_ABI, TOKEN_CONSTANTS } from "~/constants/contracts";
import { notification } from "~/utils/notification";

export function usePaintTokens() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.PAINT_TOKEN,
    abi: PAINT_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address!],
  });

  const buyTokens = useCallback(async (amount: bigint) => {
    if (!address || !publicClient) return;

    try {
      const balance = await publicClient.getBalance({ address });
      console.log("Account balance:", balance.toString());

      const contractPrice = await publicClient.readContract({
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        abi: CANVAS_ABI,
        functionName: "PAINT_TOKEN_PRICE"
      }) as bigint;

      const totalPriceInWei = amount * contractPrice;
      
      console.log('Transaction parameters:', {
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        amount: amount.toString(),
        contractPrice: contractPrice.toString(),
        totalPriceInWei: totalPriceInWei.toString(),
        priceInEth: (Number(totalPriceInWei) / 1e18).toString() + ' ETH'
      });

      const txRequest = {
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        abi: CANVAS_ABI,
        functionName: "buyPaintTokens",
        args: [amount],
        value: totalPriceInWei,
      };

      const tx = await writeContractAsync(txRequest);
      console.log("Transaction sent:", tx);

      await publicClient.waitForTransactionReceipt({ hash: tx });
      await refetchBalance(); // Refetch balance after transaction

      return tx;
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  }, [writeContractAsync, address, publicClient, refetchBalance]);

  const paintPixelRLEPalette = useCallback(async (runs: Array<{startPixel: number, length: number, color: number}>) => {
    try {
      console.log("Starting paintPixelRLEPalette with runs:", runs);

      // Create color palette and map runs to use color indices
      const colorSet = new Set(runs.map(run => run.color));
      const colors = Array.from(colorSet);
      console.log("Unique colors:", colors);

      // Map runs to include color indices
      const runsWithIndices = runs.map(run => ({
        ...run,
        colorIndex: colors.indexOf(run.color)
      }));

      // Pack the data
      const packedData = packData(runsWithIndices);
      const packedColors = packColors(colors);

      console.log("About to call writeContractAsync with args:", {
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        abi: CANVAS_ABI,
        functionName: "setPixelColorsRLEPalette",
        args: [packedData, packedColors]
      });

      const tx = await writeContractAsync({
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        abi: CANVAS_ABI,
        functionName: "setPixelColorsRLEPalette",
        args: [packedData, packedColors],
      });

      console.log("writeContractAsync returned:", tx);
      return tx;

    } catch (error: unknown) {
      console.error("Error in paintPixelRLEPalette:", error);
      throw error;
    }
  }, [writeContractAsync]);

  const paintPixelAreas = useCallback(async (areas: Array<{x: number, y: number, width: number, height: number, color: number}>) => {
    if (!address || areas.length === 0) return;

    try {
      // Add allowance check
      const currentAllowance = await publicClient?.readContract({
        address: CONTRACTS.PAINT_TOKEN,
        abi: PAINT_TOKEN_ABI,
        functionName: "allowance",
        args: [address, CONTRACTS.COLLABORATIVE_ART_CANVAS],
      }) as bigint;

      if (currentAllowance === BigInt(0)) {
        const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approvalTx = await writeContractAsync({
          address: CONTRACTS.PAINT_TOKEN,
          abi: PAINT_TOKEN_ABI,
          functionName: "approve",
          args: [CONTRACTS.COLLABORATIVE_ART_CANVAS, MAX_UINT256],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approvalTx });
      }

      // Pack the data in the new compact format (7 bytes per area)
      const packedData = new Uint8Array(areas.length * 7);
      for (let i = 0; i < areas.length; i++) {
        const offset = i * 7;
        const area = areas[i];
        
        // Pack coordinates and dimensions (1 byte each)
        packedData[offset] = area.x & 0xFF;
        packedData[offset + 1] = area.y & 0xFF;
        packedData[offset + 2] = area.width & 0xFF;
        packedData[offset + 3] = area.height & 0xFF;
        
        // Pack color (3 bytes)
        packedData[offset + 4] = (area.color >> 16) & 0xFF;
        packedData[offset + 5] = (area.color >> 8) & 0xFF;
        packedData[offset + 6] = area.color & 0xFF;
      }

      // Convert to hex string
      const packedHex = '0x' + Array.from(packedData)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('Packed data size:', packedData.length);

      const tx = await writeContractAsync({
        address: CONTRACTS.COLLABORATIVE_ART_CANVAS,
        abi: CANVAS_ABI,
        functionName: "setPixelAreasCompact", // Updated function name
        args: [packedHex],
      });

      await publicClient?.waitForTransactionReceipt({ hash: tx });
      await refetchBalance();

      return tx;
    } catch (error) {
      console.error("Error painting pixel areas:", error);
      throw error;
    }
  }, [writeContractAsync, address, publicClient, refetchBalance]);

  const findColorRuns = (pixels: Array<{pixelId: number, color: number}>) => {
    if (pixels.length === 0) return [];
    if (pixels.length === 1) {
      return [{
        startPixel: pixels[0].pixelId,
        length: 1,
        color: pixels[0].color
      }];
    }
    
    // Sort pixels by ID to find consecutive runs
    pixels.sort((a, b) => a.pixelId - b.pixelId);
    
    const runs: Array<{startPixel: number, length: number, color: number}> = [];
    let currentRun = {
      startPixel: pixels[0].pixelId,
      length: 1,
      color: pixels[0].color
    };

    for (let i = 1; i < pixels.length; i++) {
      const pixel = pixels[i];
      
      if (pixel.color === currentRun.color && 
          pixel.pixelId === currentRun.startPixel + currentRun.length) {
        // Continue current run
        currentRun.length++;
      } else {
        // Start new run
        runs.push({...currentRun});
        currentRun = {
          startPixel: pixel.pixelId,
          length: 1,
          color: pixel.color
        };
      }
    }
    
    // Don't forget the last run
    runs.push(currentRun);
    
    return runs;
  };

  const findRectangularAreas = (pixels: Array<{pixelId: number, color: number}>) => {
    if (pixels.length === 0) return [];

    // Convert pixelIds to x,y coordinates
    const pixelCoords = pixels.map(p => ({
      x: p.pixelId % 64,
      y: Math.floor(p.pixelId / 64),
      color: p.color
    }));

    // Sort by y coordinate first, then x, to find potential rectangles
    pixelCoords.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    const areas: Array<{x: number, y: number, width: number, height: number, color: number}> = [];
    const usedPixels = new Set<string>();

    // Try to find rectangles for each starting point
    for (let i = 0; i < pixelCoords.length; i++) {
      const pixel = pixelCoords[i];
      const key = `${pixel.x},${pixel.y}`;
      if (usedPixels.has(key)) continue;

      // Find maximum width
      let width = 1;
      while (
        width + pixel.x < 64 && 
        pixelCoords.find(p => 
          p.x === pixel.x + width && 
          p.y === pixel.y && 
          p.color === pixel.color &&
          !usedPixels.has(`${p.x},${p.y}`)
        )
      ) {
        width++;
      }

      // Find maximum height
      let height = 1;
      outer: while (height + pixel.y < 64) {
        // Check if entire row exists with same color
        for (let dx = 0; dx < width; dx++) {
          const nextPixel = pixelCoords.find(p => 
            p.x === pixel.x + dx && 
            p.y === pixel.y + height && 
            p.color === pixel.color &&
            !usedPixels.has(`${p.x},${p.y}`)
          );
          if (!nextPixel) break outer;
        }
        height++;
      }

      // If area is at least 2 pixels in any dimension, add it
      if (width * height > 1) {
        areas.push({
          x: pixel.x,
          y: pixel.y,
          width,
          height,
          color: pixel.color
        });

        // Mark pixels as used
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            usedPixels.add(`${pixel.x + dx},${pixel.y + dy}`);
          }
        }
      }
    }

    // Sort areas by size (largest first) to optimize gas usage
    return areas.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  };

  const isPixelInAreas = (pixelId: number, areas: Array<{x: number, y: number, width: number, height: number, color: number}>) => {
    const x = pixelId % 64;
    const y = Math.floor(pixelId / 64);

    return areas.some(area => 
      x >= area.x && x < area.x + area.width &&
      y >= area.y && y < area.y + area.height
    );
  };

  const packColors = (colors: number[]) => {
    // Create a byte array to hold RGB values
    const bytes = new Uint8Array(colors.length * 3);
    colors.forEach((color, i) => {
        // Extract RGB components
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        // Pack in RGB order
        bytes[i * 3] = r;      // R first
        bytes[i * 3 + 1] = g;  // G second
        bytes[i * 3 + 2] = b;  // B last

        // Debug log
        console.log(`Color ${i}: RGB(${r},${g},${b}) = #${color.toString(16).padStart(6, '0')}`);
    });
    
    // Convert to hex string
    const result = '0x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    console.log("Packed colors:", result);
    return result;
  };

  const packData = (runs: Array<{startPixel: number, length: number, color: number, colorIndex: number}>) => {
    console.log("packData input:", runs);
    
    const hexString = runs.map(run => {
        const positionHex = run.startPixel.toString(16).padStart(4, '0');
        const lengthHex = run.length.toString(16).padStart(2, '0');
        const colorIndexHex = run.colorIndex.toString(16).padStart(2, '0');
        const runHex = `${positionHex}${lengthHex}${colorIndexHex}`;
//        console.log(`Run converted to hex: ${runHex}`, {
//            startPixel: run.startPixel,
//            length: run.length,
//            colorIndex: run.colorIndex,
//            positionHex,
//            lengthHex,
//            colorIndexHex
//        });
        return runHex;
    }).join('');
    
    const result = `0x${hexString}`;
    console.log("packData output:", result);
    return result;
  };

  return {
    balance: balance ? Number(balance) / Number(TOKEN_CONSTANTS.TOKEN_DECIMALS) : 0,
    buyTokens,
    paintPixelRLEPalette,
    paintPixelAreas,
    findColorRuns,
    findRectangularAreas,
    isPixelInAreas,
    packColors,
    packData,
  };
} 