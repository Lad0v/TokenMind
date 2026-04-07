"use client";
import React, { useState } from 'react';

export interface DocumentUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export function DocumentUploader({ onFilesSelected }: DocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = function(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = function(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div
      className={`relative w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-200 ease-in-out
        ${dragActive ? "border-emerald-400 bg-emerald-400/10" : "border-emerald-900 bg-black/20 hover:border-emerald-700"}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input 
        id="file-upload" 
        multiple 
        type="file" 
        className="hidden" 
        onChange={handleChange} 
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
        <svg className="w-10 h-10 mb-3 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="mb-2 text-sm text-gray-400">
          <span className="font-semibold text-emerald-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">PDF, DOCX, PNG, JPG (MAX. 10MB)</p>
      </label>
    </div>
  );
}
