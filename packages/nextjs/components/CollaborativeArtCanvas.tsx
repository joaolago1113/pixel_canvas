"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { Dialog, Transition } from "@headlessui/react";
import { Eye, Image as ImageIcon, Info, Move, Paintbrush, ShoppingCart, ZoomIn, ZoomOut, Eraser } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { useCanvasData } from "~/hooks/useCanvasData";
import { usePaintTokens } from "~/hooks/usePaintTokens";
import { notification } from "~/utils/notification";
import { ConnectKitButton } from "connectkit";
import { CONTRACTS, PAINT_TOKEN_ABI, CANVAS_ABI, TOKEN_CONSTANTS } from "~/constants/contracts";
import { ImageUploadModal } from "./ImageUploadModal";

export default function CollaborativeArtCanvas() {
  // All hooks first
  const { address } = useAccount();
  const { canvasPixels, isLoading, error } = useCanvasData();
  const { 
    balance, 
    buyTokens, 
    paintPixelRLEPalette, 
    paintPixelAreas, 
    findColorRuns, 
    findRectangularAreas, 
    isPixelInAreas 
  } = usePaintTokens();
  const imageUploaderRef = useRef<HTMLInputElement>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  
  if (!publicClient) throw new Error("Public client not found");

  // All state declarations
  const [selectedPixel, setSelectedPixel] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pixels, setPixels] = useState<{ [key: number]: { color: number } }>({});
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [paintCart, setPaintCart] = useState<Array<{pixelId: number, color: number}>>([]);
  const [showCart, setShowCart] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [originalPixels, setOriginalPixels] = useState<{ [key: number]: { color: number } }>({});
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(1);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [transactionProgress, setTransactionProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  // Add token supply hook
  const { data: paintTokenTotalSupply } = useReadContract({
    address: CONTRACTS.PAINT_TOKEN,
    abi: PAINT_TOKEN_ABI,
    functionName: "totalSupply",
  });

  // All callbacks
  const handleImageUpload = useCallback(async (file: File) => {
    // ... existing image upload logic
  }, []);

  const handleColorPickerChange = useCallback((color: string) => {
    setSelectedColor(color);
    setShowColorPicker(false);
  }, []);

  const handlePixelClick = useCallback((pixelId: number) => {
    if (!address) return;
    
    if (isEraserActive) {
      // Remove pixel from cart
      const existingPixelIndex = paintCart.findIndex(item => item.pixelId === pixelId);
      if (existingPixelIndex !== -1) {
        setPaintCart(prev => prev.filter((_, index) => index !== existingPixelIndex));
        
        // Restore original pixel state
        setPixels(prev => ({
          ...prev,
          [pixelId]: originalPixels[pixelId] || canvasPixels[pixelId] || { color: 0 }
        }));
        
        // Clean up original pixel state
        setOriginalPixels(prev => {
          const newState = { ...prev };
          delete newState[pixelId];
          return newState;
        });
        
        notification.success("Pixel removed!");
      }
      return;
    }
    
    const colorValue = parseInt(selectedColor.replace("#", ""), 16);
    
    // Check if pixel is already in cart
    const existingPixelIndex = paintCart.findIndex(item => item.pixelId === pixelId);
    
    if (existingPixelIndex !== -1) {
      // If pixel exists but with a different color, update it
      const existingPixel = paintCart[existingPixelIndex];
      if (existingPixel.color !== colorValue) {
        setPaintCart(prev => {
          const newCart = [...prev];
          newCart[existingPixelIndex] = { pixelId, color: colorValue };
          return newCart;
        });
        
        // Update preview
        setPixels(prev => ({
          ...prev,
          [pixelId]: { color: colorValue }
        }));
        
        notification.success("Pixel color updated!");
      }
      return;
    }
    
    // Store original pixel state if it hasn't been stored yet
    if (!originalPixels[pixelId]) {
      setOriginalPixels(prev => ({
        ...prev,
        [pixelId]: canvasPixels[pixelId] || pixels[pixelId] || { color: 0 }
      }));
    }
    
    setPaintCart(prev => [...prev, { pixelId, color: colorValue }]);
    
    // Show preview immediately
    setPixels(prev => ({
      ...prev,
      [pixelId]: { color: colorValue }
    }));
    
    notification.success("Pixel added to cart!");
  }, [address, selectedColor, pixels, originalPixels, paintCart, isEraserActive, canvasPixels]);

  const handleCheckout = useCallback(async () => {
    if (!publicClient || paintCart.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    setBatchProgress(null);
    setTransactionProgress({ current: 0, total: 2, message: "Approving tokens..." });

    try {
      const tokensNeeded = paintCart.length;
      const currentBalance = balance;
      
      // Buy tokens if needed
      if (currentBalance < tokensNeeded) {
        const tokensToBuy = BigInt(tokensNeeded - currentBalance);
        await buyTokens(tokensToBuy);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Convert cart items to format needed for findColorRuns
      const pixels = paintCart.map(item => ({
        pixelId: item.pixelId,
        color: parseInt(item.color.toString())
      }));

      // Try to find rectangular areas first
      const areas = findRectangularAreas(pixels);
      console.log('Found rectangular areas:', areas);

      if (areas.length > 0) {
        // Use area-based painting for rectangles
        const tx = await paintPixelAreas(areas);
        if (!tx) throw new Error("Failed to paint areas");
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      // For remaining pixels, try RLE with palette
      const remainingPixels = pixels.filter(p => !isPixelInAreas(p.pixelId, areas));
      if (remainingPixels.length > 0) {
        // Find color runs for remaining pixels
        const runs = findColorRuns(remainingPixels);
        console.log('Color runs for remaining pixels:', runs);

        // Split runs into batches if we have too many colors
        const MAX_COLORS_PER_BATCH = 256;
        const batches: Array<typeof runs> = [];
        let currentBatch: typeof runs = [];
        const usedColors = new Set<number>();

        for (const run of runs) {
          if (usedColors.has(run.color)) {
            // Color already in current batch, add run
            currentBatch.push(run);
          } else if (usedColors.size < MAX_COLORS_PER_BATCH) {
            // New color, but batch not full yet
            usedColors.add(run.color);
            currentBatch.push(run);
          } else {
            // Batch full, start new batch
            if (currentBatch.length > 0) {
              batches.push(currentBatch);
            }
            currentBatch = [run];
            usedColors.clear();
            usedColors.add(run.color);
          }
        }
        
        // Don't forget the last batch
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }

        // Process each batch
        for (const batch of batches) {
          console.log("Processing batch:", batch);
          const tx = await paintPixelRLEPalette(batch);
          console.log("Received transaction:", tx);
          
          if (typeof tx === 'undefined') {
            console.error("Transaction is undefined");
            throw new Error("Failed to paint batch");
          }
          
          console.log("Waiting for transaction receipt:", tx);
          await publicClient.waitForTransactionReceipt({ hash: tx });
          console.log("Transaction confirmed");
        }
      }

      console.log('All pixels painted successfully!');
      setPaintCart([]);
      setShowCart(false);
      setOriginalPixels({});
      notification.success("Successfully painted all pixels!");

    } catch (error) {
      console.error("Error during checkout:", error);
      notification.error("Failed to complete checkout");
      setPixels(prev => ({
        ...prev,
        ...originalPixels
      }));
      setPaintCart([]);
      setOriginalPixels({});
    } finally {
      setIsCheckingOut(false);
      setBatchProgress(null);
      setTransactionProgress(null);
    }
  }, [paintCart, buyTokens, paintPixelRLEPalette, paintPixelAreas, findColorRuns, findRectangularAreas, isPixelInAreas, originalPixels, publicClient, balance, isCheckingOut]);

  const getPixelCoordinates = (pixelId: number) => {
    const x = pixelId % 64;
    const y = Math.floor(pixelId / 64);
    return { x, y };
  };

  const handleImageSelect = useCallback((pixels: { [key: number]: { color: number } }) => {
    setPixels(pixels);
    setPaintCart(Object.entries(pixels).map(([id, pixel]) => ({
      pixelId: parseInt(id),
      color: pixel.color
    })));
  }, []);

  const handleRemoveFromCart = useCallback((index: number) => {
    const removedItem = paintCart[index];
    
    // Restore original pixel state
    setPixels(prev => ({
      ...prev,
      [removedItem.pixelId]: originalPixels[removedItem.pixelId] || { color: 0 }
    }));
    
    // Remove from cart
    setPaintCart(prev => prev.filter((_, i) => i !== index));
    
    // Clean up original pixel state
    setOriginalPixels(prev => {
      const newState = { ...prev };
      delete newState[removedItem.pixelId];
      return newState;
    });
  }, [paintCart, originalPixels]);

  const handleClearCart = useCallback(() => {
    // Restore all original pixel states
    setPixels(prev => {
      const newPixels = { ...prev };
      // Clear all pixels that are in the cart
      paintCart.forEach(item => {
        if (originalPixels[item.pixelId]) {
          // Restore original pixel state
          newPixels[item.pixelId] = originalPixels[item.pixelId];
        } else {
          // If no original state exists, use the state from the canvas
          newPixels[item.pixelId] = canvasPixels[item.pixelId] || { color: 0 };
        }
      });
      return newPixels;
    });
    
    setPaintCart([]);
    setOriginalPixels({});
  }, [paintCart, originalPixels, canvasPixels]);

  // Add these handler functions
  const handleColorClick = useCallback(() => {
    setShowColorPicker(true);
    setIsEraserActive(false);
  }, []);

  const handleUploadClick = useCallback(() => {
    setShowImageUpload(true);
    setIsEraserActive(false);
  }, []);

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 via-[#0c1015] to-black">
      {/* Unified Navigation Bar - Always visible */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Main Navigation */}
          <div className="flex flex-col">
            {/* Upper Row - Logo, Stats, Connect */}
            <div className="flex flex-col sm:flex-row items-center justify-between py-3">
              {/* Logo Section */}
              <div className="w-full sm:w-auto flex justify-center sm:justify-start mb-4 sm:mb-0">
                <h1 
                  className="text-white text-2xl sm:text-4xl flex items-center gap-2" 
                  style={{ 
                    fontFamily: '"Press Start 2P", system-ui',
                    textShadow: '0 2px 10px rgba(79, 70, 229, 0.3)',
                    background: 'linear-gradient(to right, #4F46E5, #7C3AED)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '1px'
                  }}
                >
                  <Paintbrush className="h-8 w-8 text-primary animate-bounce" />
                  Pixel<span style={{ color: '#7C3AED' }}>Canvas</span>
                </h1>
              </div>

              {/* Stats & Connect Button */}
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4">
                {address ? (
                  <div className="w-full sm:w-auto grid grid-cols-2 sm:flex gap-2">
                    <div className="px-3 py-2 sm:py-1.5 rounded-lg bg-white/5 text-white/70 text-sm flex items-center justify-between sm:justify-start gap-2">
                      <span>Total:</span>
                      <span className="font-semibold text-white">
                        {paintTokenTotalSupply ? (Number(paintTokenTotalSupply) / 10 ** 18).toFixed(0) : '0'} 🖌️
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowPurchaseModal(true)}
                      className="px-3 py-2 sm:py-1.5 rounded-lg bg-white/5 text-white/70 text-sm flex items-center justify-between sm:justify-start gap-2 hover:bg-white/10 transition-colors"
                    >
                      <span>Balance:</span>
                      <span className="font-semibold text-white">{balance}</span>
                    </button>
                  </div>
                ) : null}
                
                <div className="w-full sm:w-auto flex justify-center">
                  <ConnectKitButton />
                </div>
              </div>
            </div>

            {/* Lower Row - Canvas Controls */}
            {address && (
              <div className="py-3 border-t border-white/10">
                {/* Mobile Tools */}
                <div className="block sm:hidden space-y-2">
                  <div className="bg-white/5 rounded-lg p-1">
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={handleColorClick}
                        className={`px-3 py-2 rounded-md text-white/70 hover:bg-white/10 flex items-center justify-center gap-2 transition-all ${
                          !isEraserActive ? 'bg-white/10' : ''
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: selectedColor }}
                        />
                        <span>Color</span>
                      </button>
                      <button
                        onClick={handleUploadClick}
                        className="px-3 py-2 rounded-md text-white/70 hover:bg-white/10 flex items-center justify-center gap-2 transition-all"
                      >
                        <ImageIcon className="h-4 w-4" />
                        <span>Upload</span>
                      </button>
                      <button
                        onClick={() => setIsEraserActive(!isEraserActive)}
                        className={`px-3 py-2 rounded-md text-white/70 hover:bg-white/10 flex items-center justify-center gap-2 transition-all ${
                          isEraserActive ? 'bg-white/10' : ''
                        }`}
                      >
                        <Eraser className="h-4 w-4" />
                        <span>Eraser</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleClearCart}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center gap-2 transition-all"
                      disabled={paintCart.length === 0}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowCart(true)}
                      className="px-4 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center gap-2 transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <div className="flex items-center gap-1">
                        Cart
                        {paintCart.length > 0 && (
                          <span className="bg-primary text-white text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow-lg ring-2 ring-black/20 animate-bounce">
                            {paintCart.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Desktop Tools */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                    <button
                      onClick={handleColorClick}
                      className={`px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 flex items-center gap-2 transition-all ${
                        !isEraserActive ? 'bg-white/10' : ''
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full ring-1 ring-white/20"
                        style={{ backgroundColor: selectedColor }}
                      />
                      Color
                    </button>
                    <button
                      onClick={handleUploadClick}
                      className="px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 flex items-center gap-2 transition-all"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Upload
                    </button>
                    <button
                      onClick={() => setIsEraserActive(!isEraserActive)}
                      className={`px-3 py-1.5 rounded-md text-white/70 hover:bg-white/10 flex items-center gap-2 transition-all ${
                        isEraserActive ? 'bg-white/10' : ''
                      }`}
                    >
                      <Eraser className="h-4 w-4" />
                      Eraser
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearCart}
                      className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center gap-2 transition-all"
                      disabled={paintCart.length === 0}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowCart(true)}
                      className="px-4 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center gap-2 transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <div className="flex items-center gap-1">
                        Cart
                        {paintCart.length > 0 && (
                          <span className="bg-primary text-white text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow-lg ring-2 ring-black/20 animate-bounce">
                            {paintCart.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjust the padding to prevent content overlap */}
      <div className={`${address ? "pt-[280px] sm:pt-[104px]" : ""}`}>
        {/* Main Content Area */}
        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-64px)]">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[calc(100vh-64px)]">
            <div className="text-center space-y-4">
              <p className="text-red-500">Error loading canvas data</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !address ? (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-[#0c1015] to-black">
            <div className="text-center space-y-8">
              <div className="text-white text-2xl font-semibold">Please connect your wallet to continue</div>
              <div className="text-white/60 text-sm">Connect your wallet to start painting on the canvas</div>
              <div className="mt-4 flex justify-center">
                <ConnectKitButton/>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Canvas Container */}
            <div className="relative flex-1 flex items-center justify-center p-4 sm:p-16">
              <div className="w-full max-w-5xl aspect-square rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black/20">
                <Canvas 
                  onPixelClick={handlePixelClick}
                  setPixels={setPixels}
                  pixels={pixels}
                  selectedColor={selectedColor}
                  scale={scale}
                  canvasPixels={canvasPixels}
                  isEraserActive={isEraserActive}
                />
              </div>
            </div>

            {/* Cart Modal */}
            <Transition appear show={showCart} as={Fragment}>
              <Dialog
                as="div"
                className="relative z-50"
                onClose={() => setShowCart(false)}
              >
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                
                <div className="fixed inset-0 overflow-y-auto">
                  <div className="flex min-h-full items-center justify-center p-4">
                    <Dialog.Panel 
                      className="w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all border border-white/10"
                      style={{
                        background: 'linear-gradient(to bottom, #1a1a1a, #0f0f0f)',
                      }}
                    >
                      <div className="p-6">
                        <Dialog.Title className="text-xl font-medium text-white flex justify-between items-center mb-6">
                          Shopping Cart
                          <div className="flex items-center gap-2">
                            <span className="text-sm px-3 py-1 rounded-full bg-white/5 text-white/70">
                              {paintCart.length} {paintCart.length === 1 ? 'pixel' : 'pixels'}
                            </span>
                            {paintCart.length > 0 && (
                              <button
                                onClick={handleClearCart}
                                className="text-sm px-3 py-1 rounded-full bg-white/5 text-white/70 hover:bg-white/10 transition-all"
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                        </Dialog.Title>
                        
                        <div>
                          {paintCart.length === 0 ? (
                            <div className="text-center py-12">
                              <ShoppingCart className="h-12 w-12 text-white/20 mx-auto mb-4" />
                              <p className="text-white/50">Your cart is empty</p>
                            </div>
                          ) : (
                            <>
                              <div 
                                className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"
                                style={{
                                  background: '#111111',
                                  padding: '12px',
                                  borderRadius: '12px',
                                }}
                              >
                                {paintCart.map((item, index) => (
                                  <div 
                                    key={index} 
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-8 h-8 rounded-lg shadow-lg ring-1 ring-white/10"
                                        style={{ backgroundColor: `#${item.color.toString(16).padStart(6, "0")}` }}
                                      />
                                      <span className="text-white/90 font-medium">
                                        ({getPixelCoordinates(item.pixelId).x}, {getPixelCoordinates(item.pixelId).y}) • Pixel #{item.pixelId}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveFromCart(index)}
                                      className="text-white/30 hover:text-red-400 p-2 rounded-lg transition-colors group-hover:text-white/60"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="border-t border-white/10 mt-6 pt-6">
                                <div className="flex justify-between text-lg font-medium text-white mb-6">
                                  <span>Total</span>
                                  <span className="text-primary">{paintCart.length} Tokens</span>
                                </div>
                                <button
                                  onClick={handleCheckout}
                                  disabled={isCheckingOut}
                                  className={`w-full py-3 px-4 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl ${
                                    isCheckingOut ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  style={{
                                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                                    boxShadow: '0 8px 24px -8px rgba(79, 70, 229, 0.5)',
                                  }}
                                >
                                  {isCheckingOut ? (
                                    <div className="flex flex-col items-center gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Processing...
                                      </div>
                                      {batchProgress && (
                                        <div className="text-sm text-white/70">
                                          Processing batch {batchProgress.current} of {batchProgress.total}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    `Checkout (${paintCart.length} Tokens)`
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Dialog.Panel>
                  </div>
                </div>
              </Dialog>
            </Transition>

            {/* Color Picker Modal */}
            <Transition appear show={showColorPicker} as={Fragment}>
              <Dialog
                as="div"
                className="relative z-50"
                onClose={() => setShowColorPicker(false)}
              >
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                
                <div className="fixed inset-0 overflow-y-auto">
                  <div className="flex min-h-full items-center justify-center p-4">
                    <Dialog.Panel 
                      className="w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all border border-white/10"
                      style={{
                        background: 'linear-gradient(to bottom, #1a1a1a, #0f0f0f)',
                      }}
                    >
                      <div className="p-6">
                        <Dialog.Title className="text-xl font-medium text-white mb-6">
                          Choose Color
                        </Dialog.Title>
                        
                        <div className="space-y-6">
                          {/* Color Preview */}
                          <div 
                            className="w-full h-24 rounded-lg border border-white/10"
                            style={{ backgroundColor: selectedColor }}
                          />

                          {/* Hex Input */}
                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                              Hex Color
                            </label>
                            <input
                              type="text"
                              value={selectedColor}
                              onChange={(e) => {
                                const color = e.target.value;
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(color)) {
                                  setSelectedColor(color);
                                }
                              }}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                              placeholder="#000000"
                            />
                          </div>

                          {/* Color Picker */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="color"
                              value={selectedColor}
                              onChange={(e) => setSelectedColor(e.target.value)}
                              className="w-full h-40 cursor-pointer bg-transparent"
                            />
                          </div>

                          {/* Preset Colors */}
                          <div className="grid grid-cols-8 gap-2">
                            {[
                              '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
                              '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
                              '#FF8800', '#88FF00', '#0088FF', '#FF0088',
                              '#8800FF', '#00FF88', '#888888', '#444444'
                            ].map((color) => (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>

                          {/* Apply Button */}
                          <button
                            onClick={() => setShowColorPicker(false)}
                            className="w-full py-3 px-4 text-white font-medium rounded-xl transition-all"
                            style={{
                              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                            }}
                          >
                            Apply Color
                          </button>
                        </div>
                      </div>
                    </Dialog.Panel>
                  </div>
                </div>
              </Dialog>
            </Transition>

            {/* Image Upload Modal */}
            <ImageUploadModal
              isOpen={showImageUpload}
              onClose={() => setShowImageUpload(false)}
              onImageSelect={handleImageSelect}
            />

            {/* Purchase Tokens Modal */}
            <Transition appear show={showPurchaseModal} as={Fragment}>
              <Dialog
                as="div"
                className="relative z-50"
                onClose={() => setShowPurchaseModal(false)}
              >
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                
                <div className="fixed inset-0 overflow-y-auto">
                  <div className="flex min-h-full items-center justify-center p-4">
                    <Dialog.Panel 
                      className="w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all border border-white/10"
                      style={{
                        background: 'linear-gradient(to bottom, #1a1a1a, #0f0f0f)',
                      }}
                    >
                      <div className="p-6">
                        <Dialog.Title className="text-xl font-medium text-white mb-6 flex items-center justify-between">
                          <span>Purchase Paint Tokens</span>
                          <span className="text-sm text-white/50">1 Token = 1 Pixel</span>
                        </Dialog.Title>
                        
                        <div className="space-y-6">
                          {/* Current Balance */}
                          <div className="bg-white/5 rounded-lg p-4">
                            <div className="text-sm text-white/70 mb-1">Current Balance</div>
                            <div className="text-2xl font-bold text-white">{balance} 🖌️</div>
                          </div>

                          {/* Purchase Amount Input */}
                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                              Amount to Purchase
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={purchaseAmount}
                                onChange={(e) => setPurchaseAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Enter amount..."
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                                🖌️
                              </div>
                            </div>
                          </div>

                          {/* Price Calculation */}
                          <div className="bg-white/5 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/70">Price per Token</span>
                              <span className="text-white">0.00000025 ETH</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/70">Quantity</span>
                              <span className="text-white">{purchaseAmount} Tokens</span>
                            </div>
                            <div className="border-t border-white/10 my-2" />
                            <div className="flex justify-between font-medium">
                              <span className="text-white/70">Total Price</span>
                              <span className="text-white">{(purchaseAmount * 0.00000025).toFixed(8)} ETH</span>
                            </div>
                          </div>

                          {/* Purchase Button */}
                          <button
                            onClick={() => {
                              buyTokens(BigInt(purchaseAmount));
                              setShowPurchaseModal(false);
                            }}
                            className="w-full py-3 px-4 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                            style={{
                              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                              boxShadow: '0 8px 24px -8px rgba(79, 70, 229, 0.5)',
                            }}
                          >
                            Purchase Tokens
                          </button>

                          {/* Help Text */}
                          <p className="text-xs text-white/40 text-center">
                            Tokens are used to paint pixels on the canvas. Each pixel costs 1 token.
                          </p>
                        </div>
                      </div>
                    </Dialog.Panel>
                  </div>
                </div>
              </Dialog>
            </Transition>

            {transactionProgress && (
              <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-sm">
                    {transactionProgress.message} ({transactionProgress.current}/{transactionProgress.total})
                  </div>
                  <div className="w-full max-w-xs bg-blue-600 rounded-full h-2">
                    <div 
                      className="bg-white h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${(transactionProgress.current / transactionProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 