import { database } from '@/lib/firebase';
import { push, ref, set } from 'firebase/database';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface SaveMissingRequest {
  name: string;
  age: number;
  description: string;
  imageUrl: string;
  embedding: number[];
}

interface MissingPersonRecord {
  name: string;
  age: number;
  description: string;
  imageUrl: string;
  embedding: number[];
  createdAt: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SaveMissingRequest;

    const { name, age, description, imageUrl, embedding } = body;

    if (!name || !age || !description || !imageUrl || !embedding) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(embedding) || embedding.length !== 512) {
      return NextResponse.json(
        { error: 'Embedding must be a 512-dimensional array' },
        { status: 400 }
      );
    }

    const missingRef = ref(database, 'missing_persons');
    const newRecord = push(missingRef);

    const missingPersonData: MissingPersonRecord = {
      name: String(name).trim(),
      age: Number(age),
      description: String(description).trim(),
      imageUrl: String(imageUrl),
      embedding,
      createdAt: Date.now(),
    };

    await set(newRecord, missingPersonData);

    return NextResponse.json(
      {
        success: true,
        id: newRecord.key,
        message: 'Missing person reported successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving missing person:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: `Failed to save missing person: ${errorMessage}` },
      { status: 500 }
    );
  }
}
