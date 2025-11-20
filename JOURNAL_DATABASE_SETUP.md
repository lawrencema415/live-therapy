# Journal Feature Database Setup

This document describes the database schema and storage setup required for the journal feature.

## Database Tables

### `journal_entries` Table

Create this table in your Supabase database:

```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_created_at ON journal_entries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own entries
CREATE POLICY "Users can read their own journal entries"
  ON journal_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own entries
CREATE POLICY "Users can insert their own journal entries"
  ON journal_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own entries
CREATE POLICY "Users can update their own journal entries"
  ON journal_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own entries
CREATE POLICY "Users can delete their own journal entries"
  ON journal_entries
  FOR DELETE
  USING (auth.uid() = user_id);
```

## Storage Bucket

### `journal-images` Storage Bucket

Create a storage bucket in Supabase for journal images:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `journal-images`
3. Make it **public** (or configure policies as needed)
4. Set up the following storage policies:

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Users can upload journal images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to read images
CREATE POLICY "Users can read journal images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'journal-images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete journal images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'journal-images' AND
    auth.role() = 'authenticated'
  );
```

## Notes

- The `images` column stores an array of public URLs to images in the storage bucket
- Images are organized by user ID and entry ID in the storage bucket
- The storage bucket should be public if you want images to be directly accessible via URL
- If you prefer private storage, you'll need to generate signed URLs instead of public URLs

