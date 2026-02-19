'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search, ShieldCheck, Upload } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import DashboardLayout from '@/app/dashboard/layout-base';

type VerifyStatus = 'idle' | 'loading';

interface BackendError {
  detail?: string;
  message?: string;
  error?: string;
}

interface EmbeddingResponse {
  embedding: number[];
}

interface MatchResult {
  person_id?: string;
  name?: string;
  age?: number;
  description?: string;
  imageUrl?: string;
  similarity: number;
}

interface MatchFaceResponse {
  status: string;
  matches_found: number;
  threshold: number;
  matches: MatchResult[];
}

const EMBEDDING_ENDPOINT = 'http://localhost:8000/generate-embedding';
const MATCH_ENDPOINT = 'http://localhost:8000/match-face?threshold=0.55';

function getSimilarityStyles(similarity: number): string {
  if (similarity >= 0.75) {
    return 'bg-green-900/60 text-green-300 border border-green-700';
  }

  if (similarity >= 0.6) {
    return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700';
  }

  return 'bg-red-900/60 text-red-300 border border-red-700';
}

function formatSimilarity(similarity: number): string {
  return `${(similarity * 100).toFixed(2)}%`;
}

export default function AdminFaceVerificationPage() {
  const [isAdminControlSession, setIsAdminControlSession] = useState<boolean | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hasAdminControlAuth = localStorage.getItem('admin-control-auth') === 'true';
    setIsAdminControlSession(hasAdminControlAuth);
  }, []);

  const isLoading = status === 'loading';

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.similarity - a.similarity),
    [results]
  );

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setErrorMessage(null);
    setResults([]);
    setHasSearched(false);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage('Please select a valid image file.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const generateEmbedding = async (file: File): Promise<number[]> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let backendError = 'Failed to generate embedding.';
      try {
        const errorBody = (await response.json()) as BackendError;
        backendError = errorBody.detail || errorBody.message || backendError;
      } catch {
        backendError = `Failed to generate embedding (HTTP ${response.status}).`;
      }
      throw new Error(backendError);
    }

    const data = (await response.json()) as EmbeddingResponse;

    if (!Array.isArray(data.embedding) || data.embedding.length !== 512) {
      throw new Error('Invalid embedding received from backend. Expected a 512-d vector.');
    }

    return data.embedding;
  };

  const findMatches = async (file: File): Promise<MatchResult[]> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(MATCH_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let backendError = 'Failed to match face.';
      try {
        const errorBody = (await response.json()) as BackendError;
        backendError = errorBody.detail || errorBody.message || errorBody.error || backendError;
      } catch {
        backendError = `Failed to match face (HTTP ${response.status}).`;
      }
      throw new Error(backendError);
    }

    const data = (await response.json()) as MatchFaceResponse;

    if (!Array.isArray(data.matches)) {
      throw new Error('Invalid match response from backend.');
    }

    return data.matches;
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Please upload an image before verification.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setResults([]);

    try {
      await generateEmbedding(selectedFile);
      const matches = await findMatches(selectedFile);

      setResults(matches);
      setHasSearched(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected error during verification. Please try again.';

      if (message.toLowerCase().includes('no face')) {
        setErrorMessage('No face detected in the uploaded image. Please upload a clearer photo.');
      } else {
        setErrorMessage(message);
      }
      setHasSearched(true);
    } finally {
      setStatus('idle');
    }
  };

  const content = (
    <DashboardLayout adminPage>
      <div className="space-y-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-900/40 border border-blue-800 flex items-center justify-center">
                <ShieldCheck className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin Face Verification</h1>
                <p className="text-gray-400 mt-2">
                  Upload an image to generate a face embedding and search matches from missing-person records.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerify} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div>
              <label htmlFor="verify-photo" className="block text-sm font-medium text-gray-300 mb-2">
                Upload Image
              </label>
              <div className="relative">
                <input
                  id="verify-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-900 file:text-blue-200 hover:file:bg-blue-800"
                  disabled={isLoading}
                />
                <Upload size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {previewUrl && (
              <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
                <p className="text-sm text-gray-400 mb-3">Selected image preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected for verification"
                  className="w-full max-h-96 object-contain rounded-lg border border-gray-800"
                />
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <p className="text-red-200 text-sm">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Verify Face
                </>
              )}
            </button>
          </form>

        <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Match Results</h2>
              {hasSearched && !isLoading && (
                <span className="text-sm text-gray-400">
                  {sortedResults.length > 0 ? `${sortedResults.length} match(es) found` : 'No match found'}
                </span>
              )}
            </div>

            {isLoading && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex items-center justify-center gap-3 text-gray-300">
                <Loader2 className="animate-spin" size={22} />
                <span>Verifying against stored embeddings...</span>
              </div>
            )}

            {!isLoading && hasSearched && sortedResults.length === 0 && !errorMessage && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
                No match found
              </div>
            )}

            {!isLoading && sortedResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedResults.map((result, index) => (
                  <article
                    key={`${result.person_id || result.name || 'unknown'}-${result.imageUrl || 'no-image'}-${index}`}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg"
                  >
                    {result.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.imageUrl}
                        alt={result.name || 'Matched person'}
                        className="w-full h-56 object-cover border-b border-gray-800"
                      />
                    ) : (
                      <div className="w-full h-56 border-b border-gray-800 bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
                        No image available
                      </div>
                    )}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold truncate">{result.name || result.person_id || 'Unknown'}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getSimilarityStyles(result.similarity)}`}>
                          {formatSimilarity(result.similarity)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-300">
                        <span className="text-gray-400">Age:</span> {typeof result.age === 'number' ? result.age : 'N/A'}
                      </p>

                      <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">
                        <span className="text-gray-400">Description:</span> {result.description || 'No description available'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>
    </DashboardLayout>
  );

  if (isAdminControlSession === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="animate-spin" size={22} />
          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  if (isAdminControlSession) {
    return content;
  }

  return <ProtectedRoute requiredRole="admin">{content}</ProtectedRoute>;
}
