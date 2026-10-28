-- Videa při převzetí (motor, zvuky, závady): povolit videoformáty iPadu/iPhonu, max. 50 MB na soubor
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'application/pdf',
                               'video/quicktime', 'video/mp4', 'video/x-m4v', 'video/webm']
where id = 'soubory';
