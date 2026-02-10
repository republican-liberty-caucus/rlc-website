-- Create public uploads bucket for editor images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to the images/ path only
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'images'
  );

-- Public read access
CREATE POLICY "Public read access on uploads" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'uploads');
