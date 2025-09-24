-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Create storage policies for receipts
CREATE POLICY "Users can view their own receipt files" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own receipt files" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all receipt files" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'receipts' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  )
);

-- Update files table to include metadata
ALTER TABLE public.files ADD COLUMN metadata JSONB DEFAULT '{}';