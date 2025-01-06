import React from "react";

export const Footer = () => {
  return (
    <div className="py-5 px-1 mb-11 lg:mb-0 bg-gradient-to-r from-blue-900 to-blue-800">
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-4 text-sm w-full text-gray-300">
            <div className="flex items-center gap-1">
              <span className="font-semibold">Collaborative Art Canvas</span>
            </div>
            <span>·</span>
            <div className="text-center">
              <a href="https://pixelcanvas.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                Official Website
              </a>
            </div>
            <span>·</span>
            <div className="text-center">
              <a href="#" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
}; 
