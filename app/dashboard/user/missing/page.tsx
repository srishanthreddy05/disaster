'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Upload } from 'lucide-react';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface ErrorResponse {
  detail?: string;
  message?: string;
}

export default function AddMissingPersonPage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setErrorMessage(null);
  };

  const generateEmbedding = async (file: File): Promise<number[]> => {
    console.log('[Embedding] Starting embedding generation for:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/generate-embedding', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        console.error('[Embedding] Failed to generate embedding:', error);
        throw new Error(
          error.detail || 'Failed to generate face embedding. Ensure a clear face is visible in the photo.'
        );
      }

      const data = (await response.json()) as { embedding: number[] };
      
      if (!Array.isArray(data.embedding) || data.embedding.length !== 512) {
        console.error('[Embedding] Invalid embedding response:', data);
        throw new Error('Invalid embedding received from server');
      }

      console.log('[Embedding] Successfully generated 512-d embedding');
      return data.embedding;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to')) {
        throw error;
      }
      console.error('[Embedding] Network error:', error);
      throw new Error('Network error connecting to AI backend. Ensure the backend is running on port 8000.');
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    // Step 1: Validate environment variables
    if (!cloudName) {
      console.error('[Cloudinary] Cloud name is not configured');
      throw new Error(
        'Cloudinary cloud name is not configured. Please add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME to .env.local'
      );
    }

    if (!uploadPreset) {
      console.error('[Cloudinary] Upload preset is not configured');
      throw new Error(
        'Cloudinary upload preset is not configured. Please add NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local'
      );
    }

    // Log configuration (without exposing secrets)
    console.log('[Cloudinary] Starting upload with cloud:', cloudName);

    // Step 2: Prepare upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      // Step 3: Post to Cloudinary
      console.log('[Cloudinary] Sending request to Cloudinary...');
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      // Step 4: Handle HTTP errors
      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: { message: string };
        };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        console.error('[Cloudinary] Upload failed:', errorMessage);
        throw new Error(
          `Failed to upload to Cloudinary: ${errorMessage}. Check your upload preset and cloud name.`
        );
      }

      // Step 5: Parse response
      const data = (await response.json()) as {
        secure_url?: string;
        public_id?: string;
        error?: { message: string };
      };

      // Step 6: Validate response contains secure_url
      if (!data.secure_url) {
        console.error('[Cloudinary] Invalid response - no secure_url:', data);
        throw new Error('Cloudinary upload succeeded but returned no image URL');
      }

      console.log('[Cloudinary] Upload successful:', data.public_id);
      return data.secure_url;
    } catch (error) {
      // Network or other fetch error
      if (error instanceof TypeError) {
        console.error('[Cloudinary] Network error:', error.message);
        throw new Error(
          'Network error while uploading to Cloudinary. Check your internet connection and try again.'
        );
      }
      // Re-throw if already our error
      if (error instanceof Error && error.message.includes('Cloudinary')) {
        throw error;
      }
      // Unknown error
      console.error('[Cloudinary] Unknown error:', error);
      throw new Error('Unknown error uploading to Cloudinary. Please try again.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    console.log('[Form] Submitting missing person report...');

    if (!name.trim() || !age.trim() || !description.trim() || !photoFile) {
      const message = 'All fields are required';
      console.error('[Form]', message);
      setErrorMessage(message);
      return;
    }

    if (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 150) {
      const message = 'Age must be a valid number between 1 and 150';
      console.error('[Form]', message);
      setErrorMessage(message);
      return;
    }

    setStatus('loading');
    console.log('[Form] Validation passed, starting upload sequence...');

    try {
      // Step 1: Generate embedding
      console.log('[Form] Step 1/3: Generating face embedding from photo...');
      const embedding = await generateEmbedding(photoFile);

      // Step 2: Upload to Cloudinary
      console.log('[Form] Step 2/3: Uploading photo to Cloudinary...');
      const imageUrl = await uploadToCloudinary(photoFile);
      console.log('[Form] Photo uploaded successfully:', imageUrl);

      // Step 3: Save to backend
      console.log('[Form] Step 3/3: Saving report to Firebase...');
      const response = await fetch('/api/save-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          age: parseInt(age, 10),
          description: description.trim(),
          imageUrl,
          embedding,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        console.error('[Form] Failed to save to database:', error);
        throw new Error(error.error || 'Failed to save missing person report');
      }

      console.log('[Form] All steps completed successfully!');
      setSuccessMessage('Missing person report submitted successfully!');
      setName('');
      setAge('');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setStatus('success');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[Form] Error during submission:', errorMsg);
      setErrorMessage(errorMsg);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Report Missing Person</h1>
          <p className="text-gray-400">
            Help us locate missing individuals by providing their details and photo.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 font-semibold">Error</p>
                <p className="text-red-300 text-sm mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-200 font-semibold">Success</p>
                <p className="text-green-300 text-sm mt-1">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name*</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              disabled={status === 'loading'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Age*</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age"
              min="1"
              max="150"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              disabled={status === 'loading'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description*</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Physical description, clothing, last seen location, etc."
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 resize-none"
              disabled={status === 'loading'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Photo*</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="photo-input"
                disabled={status === 'loading'}
                required
              />
              <label
                htmlFor="photo-input"
                className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-600 rounded-lg p-6 cursor-pointer hover:bg-gray-900/50 transition-colors"
              >
                <Upload size={20} className="text-gray-400" />
                <div className="text-center">
                  <p className="text-gray-300 font-medium">
                    {photoFile ? photoFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {photoFile ? 'Photo selected' : 'PNG, JPG or GIF (max 10MB)'}
                  </p>
                </div>
              </label>
            </div>

            {photoPreview && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">Preview:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border border-gray-700"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Submit Report'
            )}
          </button>
        </form>

        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <p className="text-blue-200 text-sm">
            <strong>Note:</strong> Your report will be shared with rescue teams and volunteers in the system.
            The photo will be used to identify the missing person using our AI matching system.
          </p>
        </div>
      </div>
    </div>
  );
}
