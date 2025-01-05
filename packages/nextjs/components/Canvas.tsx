import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useReadContract } from "wagmi";
import { CONTRACTS, CANVAS_ABI } from "~/constants/contracts";

interface CanvasProps {
  onPixelClick: (pixelId: number) => void;
  setPixels: React.Dispatch<React.SetStateAction<{ [key: number]: { color: number } }>>;
  pixels: { [key: number]: { color: number } };
  selectedColor: string;
  scale: number;
  pixelOwners: { [key: number]: { color: number } };
  isEraserActive: boolean;
}

export function Canvas({ 
  onPixelClick,
  setPixels,
  pixels,
  selectedColor,
  scale,
  pixelOwners,
  isEraserActive
}: CanvasProps) {
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [internalScale, setInternalScale] = useState(1);
  const [pixelSize, setPixelSize] = useState(16);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const totalPixels = useMemo(() => {
    if (canvasWidth && canvasHeight) {
      return Number(canvasWidth) * Number(canvasHeight);
    }
    return 0;
  }, [canvasWidth, canvasHeight]);

  const handlePixelHover = useCallback((pixelId: number) => {
    setHoveredPixel(pixelId);
  }, []);

  // Add initial size state
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Calculate pixel size and scale based on container
  useEffect(() => {
    if (!canvasRef.current || !canvasWidth) return;

    const updateSize = () => {
      const GRID_DIMENSION = 64;
      const PADDING = 16;
      
      const container = canvasRef.current;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const size = Math.min(containerRect.width, containerRect.height);
      
      setContainerSize({
        width: size,
        height: size
      });
      
      const newPixelSize = Math.floor(
        (size - PADDING * 2) / GRID_DIMENSION * 0.98
      );
      
      setPixelSize(newPixelSize);
    };

    // Add resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
      updateSize();
    });

    resizeObserver.observe(canvasRef.current);

    // Initial size calculation
    updateSize();

    return () => {
      if (canvasRef.current) {
        resizeObserver.unobserve(canvasRef.current);
      }
    };
  }, [canvasWidth, isInitialLoad]);

  const handleMouseDown = (pixelId: number) => {
    setIsDrawing(true);
    onPixelClick(pixelId);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseEnter = (pixelId: number) => {
    setHoveredPixel(pixelId);
    if (isDrawing) {
      onPixelClick(pixelId);
    }
  };

  useEffect(() => {
    // Add global mouse up handler to stop drawing even if mouse is released outside canvas
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const pixelElements = useMemo(() => {
    const elements = [];
    for (let i = 0; i < totalPixels; i++) {
      const pixel = pixels[i] || pixelOwners[i] || { color: 0x000000 };
      const isHovered = hoveredPixel === i;
      const coords = {
        x: i % 64,
        y: Math.floor(i / 64)
      };
      
      // Determine if tooltip should appear below based on y coordinate
      const showTooltipBelow = coords.y < 8; // Show below for first 8 rows
      
      elements.push(
        <div
          key={i}
          onMouseDown={() => handleMouseDown(i)}
          onMouseEnter={() => handleMouseEnter(i)}
          onMouseUp={handleMouseUp}
          style={{
            backgroundColor: `#${pixel.color.toString(16).padStart(6, "0")}`,
            cursor: isEraserActive ? "not-allowed" : "pointer",
            border: isHovered ? "1px solid white" : "1px solid rgba(255,255,255,0.1)",
            boxShadow: isHovered ? "0 0 10px rgba(255,255,255,0.5)" : "none",
            transition: "all 0.2s ease",
            width: `${pixelSize}px`,
            height: `${pixelSize}px`,
            userSelect: 'none',
          }}
          className="relative"
        >
          {isHovered && (
            <div 
              className={`absolute ${
                showTooltipBelow 
                  ? "top-full -translate-y-0" 
                  : "bottom-full -translate-y-0"
              } left-1/2 transform -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none`}
            >
              ({coords.x}, {coords.y})
            </div>
          )}
        </div>
      );
    }
    return elements;
  }, [totalPixels, pixels, pixelOwners, onPixelClick, hoveredPixel, pixelSize, isDrawing, isEraserActive]);

  // Add this to prevent default scroll behavior
  useEffect(() => {
    const preventDefault = (e: WheelEvent) => {
      if (canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventDefault, { passive: false });
    return () => window.removeEventListener('wheel', preventDefault);
  }, []);

  // Consolidate loading checks
  const isLoading = !canvasWidth || !canvasHeight || !pixelOwners;
  const hasNoData = !pixelOwners || Object.keys(pixelOwners).length === 0;

  useEffect(() => {
    if (pixelOwners && Object.keys(pixelOwners).length > 0) {
      console.log("[Canvas] Rendering with pixel data:", Object.keys(pixelOwners).length);
    }
  }, [pixelOwners]);

  if (isLoading || hasNoData) {
    console.log("[Canvas] Loading state:", { isLoading, hasNoData, pixelOwnersCount: Object.keys(pixelOwners || {}).length });
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Remove the other loading checks and proceed with render
  return (
    <div 
      ref={canvasRef} 
      className="w-full h-full relative"
      style={{
        // Set initial size to prevent layout shift
        minHeight: isInitialLoad ? '0' : undefined,
        aspectRatio: '1 / 1'
      }}
    >
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={2}
        centerOnInit={true}
        limitToBounds={true}
        panning={{ disabled: true }}
        pinch={{ disabled: true }}
      >
        <TransformComponent
          wrapperStyle={{
            width: '100%',
            height: '100%',
          }}
          contentStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div 
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(64, ${pixelSize}px)`,
              backgroundColor: "#2a2a2a",
              boxShadow: "0 0 20px rgba(0,0,0,0.5)",
              opacity: isInitialLoad ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out',
            }}
          >
            {pixelElements}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
} 