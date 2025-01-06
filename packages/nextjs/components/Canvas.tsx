import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useReadContract } from "wagmi";
import { CONTRACTS, CANVAS_ABI } from "~/constants/contracts";
import { useCanvasData } from "~/hooks/useCanvasData";

interface CanvasProps {
  onPixelClick: (pixelId: number) => void;
  setPixels: React.Dispatch<React.SetStateAction<{ [key: number]: { color: number } }>>;
  pixels: { [key: number]: { color: number } };
  selectedColor: string;
  scale: number;
  canvasPixels: { [key: number]: { color: number } };
  isEraserActive: boolean;
}

// Add these styles to the canvas container
const canvasContainerStyle = {
  touchAction: 'none', // Prevents default touch actions
  WebkitTouchCallout: 'none', // Prevents iOS callout
  WebkitUserSelect: 'none', // Prevents text selection
  WebkitTapHighlightColor: 'transparent', // Removes tap highlight
} as const;

export function Canvas({ 
  onPixelClick,
  setPixels,
  pixels,
  selectedColor,
  scale,
  canvasPixels,
  isEraserActive
}: CanvasProps) {
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [internalScale, setInternalScale] = useState(1);
  const [pixelSize, setPixelSize] = useState(16);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add loading state tracking
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const maxAttempts = 3;

  // Define loading state
  const isLoading = !canvasPixels;

  const totalPixels = useMemo(() => {
    return 64 * 64; // Hardcode dimensions since we know them
  }, []);

  const handlePixelHover = useCallback((pixelId: number) => {
    setHoveredPixel(pixelId);
  }, []);

  // Add initial size state
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Calculate pixel size and scale based on container
  useEffect(() => {
    if (!canvasRef.current) return;

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
  }, [isInitialLoad]);

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
      const pixel = pixels[i] || canvasPixels[i] || { color: 0x000000 };
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
  }, [totalPixels, pixels, canvasPixels, onPixelClick, hoveredPixel, pixelSize, isDrawing, isEraserActive]);

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

  // Add debug logging for loading state
  useEffect(() => {
    console.log("[Canvas] Loading state:", {
      hasPixelOwners: !!canvasPixels,
      pixelOwnersCount: canvasPixels ? Object.keys(canvasPixels).length : 0,
      isLoading,
      loadingAttempts
    });
  }, [canvasPixels, isLoading, loadingAttempts]);

  useEffect(() => {
    if (isLoading && loadingAttempts < maxAttempts) {
      const timer = setTimeout(() => {
        setLoadingAttempts(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingAttempts]);

  // Add touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default touch behavior
  };

  if (isLoading) {
    if (loadingAttempts >= maxAttempts) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-500">
          <p>Failed to load canvas data</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-gray-500">
          Loading canvas... ({loadingAttempts + 1}/{maxAttempts})
        </p>
      </div>
    );
  }

  // Remove the other loading checks and proceed with render
  return (
    <div 
      ref={canvasRef} 
      className="w-full h-full relative"
      onTouchStart={handleTouchStart}
      style={{
        ...canvasContainerStyle,
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
        doubleClick={{ disabled: true }} // Disable double click zoom
      >
        <TransformComponent
          wrapperStyle={{
            width: '100%',
            height: '100%',
            touchAction: 'none', // Add this to prevent touch actions
          }}
          contentStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none', // Add this to prevent touch actions
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