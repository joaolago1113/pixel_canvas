import { toast } from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import React from "react";

const NOTIFICATIONS_ENABLED = true;

export const notification = {
  success: (message: string) => {
    if (!NOTIFICATIONS_ENABLED) return;
    
    return toast.custom(
      <div className="flex items-center gap-2 bg-green-50 p-4 rounded-lg shadow-lg border border-green-200">
        <CheckCircleIcon className="h-6 w-6 text-green-500" />
        <p className="text-green-800">{message}</p>
        <button onClick={() => toast.dismiss()} className="ml-auto">
          <XMarkIcon className="h-5 w-5 text-green-500" />
        </button>
      </div>,
      { duration: 4000 }
    );
  },

  error: (message: string) => {
    if (!NOTIFICATIONS_ENABLED) return;
    
    return toast.custom(
      <div className="flex items-center gap-2 bg-red-50 p-4 rounded-lg shadow-lg border border-red-200">
        <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
        <p className="text-red-800">{message}</p>
        <button onClick={() => toast.dismiss()} className="ml-auto">
          <XMarkIcon className="h-5 w-5 text-red-500" />
        </button>
      </div>,
      { duration: 4000 }
    );
  },
}; 