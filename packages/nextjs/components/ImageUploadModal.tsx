import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useRef, useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (pixels: { [key: number]: { color: number } }) => void;
}

export function ImageUploadModal({ isOpen, onClose, onImageSelect }: ImageUploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageData, setImageData] = useState<{ [key: number]: { color: number } } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 32, height: 32 });
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [inputDimensions, setInputDimensions] = useState({ width: "32", height: "32" });
  const [shouldRedraw, setShouldRedraw] = useState(false);

  useEffect(() => {
    if (shouldRedraw && currentImage) {
      drawImage(currentImage);
      setShouldRedraw(false);
    }
  }, [dimensions, shouldRedraw]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setCurrentImage(img);
        drawImage(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const drawImage = (img: HTMLImageElement) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Set canvas to current dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // Clear canvas and disable smoothing
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image scaled to current dimensions
    ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, dimensions.width, dimensions.height);
    const pixels: { [key: string]: { color: number } } = {};

    // Process each pixel
    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const i = (y * dimensions.width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a < 128) continue;
        const color = (r << 16) | (g << 8) | b;
        
        if (color > 0) {
          pixels[`${x},${y}`] = { color };
        }
      }
    }

    setImageData(pixels);
    setPreview(canvas.toDataURL());
  };

  const handlePositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPosition(prev => ({
      ...prev,
      [name]: Math.max(0, Math.min(63, parseInt(value) || 0))
    }));
  };

  const handleDimensionChange = (dimension: 'width' | 'height', value: string) => {
    const parsedValue = parseInt(value);
    
    if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 64) {
      setInputDimensions(prev => ({ ...prev, [dimension]: value }));
      setDimensions(prev => ({ ...prev, [dimension]: parsedValue }));
      setShouldRedraw(true);
    }
  };

  const handleApply = () => {
    if (!imageData) return;

    const finalPixels: { [key: number]: { color: number } } = {};
    
    // Process each pixel using its stored coordinates
    Object.entries(imageData).forEach(([coords, pixel]) => {
      // Extract x,y from stored coordinates
      const [x, y] = coords.split(',').map(Number);
      
      // Calculate target position
      const targetX = position.x + x;
      const targetY = position.y + y;
      
      // Only include pixels within canvas bounds
      if (targetX >= 0 && targetX < 64 && targetY >= 0 && targetY < 64) {
        // Convert to final index using canvas width of 64
        const targetIndex = targetY * 64 + targetX;
        finalPixels[targetIndex] = { color: pixel.color };
      }
    });

    onImageSelect(finalPixels);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all border border-white/10 bg-gradient-to-b from-gray-900 to-black">
              <div className="p-6">
                <Dialog.Title className="text-xl font-medium text-white mb-6">
                  Upload & Position Image
                </Dialog.Title>
                
                <div className="space-y-4">
                  <div 
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/20 transition-all cursor-pointer"
                    onClick={() => document.getElementById('imageInput')?.click()}
                  >
                    {preview ? (
                      <img src={preview} alt="Preview" className="max-w-full h-auto mx-auto" />
                    ) : (
                      <>
                        <ImageIcon className="h-12 w-12 mx-auto mb-4 text-white/20" />
                        <p className="text-white/50">Click to upload image</p>
                      </>
                    )}
                    <input
                      id="imageInput"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    />
                  </div>

                  {preview && (
                    <div className="space-y-4">
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white/70 mb-1">Width (px)</label>
                          <input
                            type="number"
                            value={inputDimensions.width}
                            onChange={(e) => handleDimensionChange('width', e.target.value)}
                            min={1}
                            max={64}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white/70 mb-1">Height (px)</label>
                          <input
                            type="number"
                            value={inputDimensions.height}
                            onChange={(e) => handleDimensionChange('height', e.target.value)}
                            min={1}
                            max={64}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          />
                        </div>
                      </div>
                      <p className="text-sm text-white/60 mb-2">
                        Choose where to place the top-left corner of your image on the canvas
                      </p>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white/70 mb-1">X Position (0-63)</label>
                          <input
                            type="number"
                            name="x"
                            value={position.x}
                            onChange={handlePositionChange}
                            min={0}
                            max={63}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white/70 mb-1">Y Position (0-63)</label>
                          <input
                            type="number"
                            name="y"
                            value={position.y}
                            onChange={handlePositionChange}
                            min={0}
                            max={63}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        Image size: {dimensions.width}x{dimensions.height} pixels
                      </p>

                      <button
                        onClick={handleApply}
                        className="w-full py-3 px-4 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                        style={{
                          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                          boxShadow: '0 8px 24px -8px rgba(79, 70, 229, 0.5)',
                        }}
                      >
                        Apply to Canvas
                      </button>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 