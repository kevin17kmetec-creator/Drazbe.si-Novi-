const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const target = `                // Sequential upload allows cancellation easily
                for (let i = 0; i < imageFiles.length; i++) {
                    if (cancelRef.current) throw new Error('CANCELED');
                    
                    const compressedFile = imageFiles[i];
                    setUploadProgress(prev => ({ ...prev, [i]: { state: t('preparing'), percent: 20 } }));
                    
                    if (cancelRef.current) throw new Error('CANCELED');
                    
                    const fileName = \`\${Date.now()}-\${compressedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}\`;
                    const storageRef = ref(storage, \`auction-images/\${fileName}\`);
                    
                    const uploadTask = uploadBytesResumable(storageRef, compressedFile, { contentType: compressedFile.type });
                    activeUploadTaskRef.current = uploadTask;

                    // Track actual upload progress
                    uploadTask.on('state_changed', (snapshot) => {
                        if (snapshot.totalBytes > 0) {
                            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                            setUploadProgress(prev => ({ ...prev, [i]: { state: t('uploading'), percent } }));
                        }
                    });

                    let downloadUrl = '';
                    try {
                        await uploadTask;
                        downloadUrl = await getDownloadURL(storageRef);
                        uploadedFilesRef.current.push(fileName);
                    } catch (e: any) {
                        activeUploadTaskRef.current = null;
                        if (cancelRef.current || e?.code === 'storage/canceled') {
                            throw new Error('CANCELED');
                        }
                        console.warn("Firebase Storage upload encountered an error, falling back to data URL:", e);
                        // Fallback to Base64 Data URL so auction publishing never fails due to storage CORS/quota issues
                        downloadUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(compressedFile);
                        });
                    }
                    
                    activeUploadTaskRef.current = null;
                    if (cancelRef.current) throw new Error('CANCELED');

                    imageUrls.push(downloadUrl);
                    setUploadProgress(prev => ({ ...prev, [i]: { state: 'Zaključeno', percent: 100 } }));
                }`;

const replacement = `                // Upload all images in parallel for maximum speed
                const activeTasks: UploadTask[] = [];
                const uploadPromises = imageFiles.map(async (compressedFile, i) => {
                    if (cancelRef.current) throw new Error('CANCELED');
                    setUploadProgress(prev => ({ ...prev, [i]: { state: t('preparing'), percent: 20 } }));
                    
                    const fileName = \`\${Date.now()}-\${Math.random().toString(36).substring(7)}-\${compressedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}\`;
                    const storageRef = ref(storage, \`auction-images/\${fileName}\`);
                    
                    const uploadTask = uploadBytesResumable(storageRef, compressedFile, { contentType: compressedFile.type });
                    activeTasks.push(uploadTask);

                    uploadTask.on('state_changed', (snapshot) => {
                        if (snapshot.totalBytes > 0) {
                            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                            setUploadProgress(prev => ({ ...prev, [i]: { state: t('uploading'), percent } }));
                        }
                    });

                    let downloadUrl = '';
                    try {
                        await uploadTask;
                        downloadUrl = await getDownloadURL(storageRef);
                        uploadedFilesRef.current.push(fileName);
                    } catch (e: any) {
                        if (cancelRef.current || e?.code === 'storage/canceled') {
                            throw new Error('CANCELED');
                        }
                        console.warn("Firebase Storage upload encountered an error, falling back to data URL:", e);
                        downloadUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(compressedFile);
                        });
                    }
                    
                    setUploadProgress(prev => ({ ...prev, [i]: { state: 'Zaključeno', percent: 100 } }));
                    return { i, url: downloadUrl };
                });

                // Re-implement the active task canceling via a small hack since we can't easily change the ref type here
                // We'll attach our activeTasks array to the ref temporarily if it's an object
                (activeUploadTaskRef as any).currentTasks = activeTasks;

                const results = await Promise.all(uploadPromises);
                
                // Maintain order
                results.sort((a, b) => a.i - b.i);
                results.forEach(res => imageUrls.push(res.url));
                
                if (cancelRef.current) throw new Error('CANCELED');`;

code = code.replace(target, replacement);

const cancelTarget = `        if (activeUploadTaskRef.current) {
            try {
                activeUploadTaskRef.current.cancel();
            } catch (e) {
                console.log("Error canceling active upload task:", e);
            }
            activeUploadTaskRef.current = null;
        }`;

const cancelReplacement = `        if (activeUploadTaskRef.current) {
            try { activeUploadTaskRef.current.cancel(); } catch (e) {}
            activeUploadTaskRef.current = null;
        }
        if ((activeUploadTaskRef as any).currentTasks) {
            (activeUploadTaskRef as any).currentTasks.forEach((t: any) => {
                try { t.cancel(); } catch (e) {}
            });
            (activeUploadTaskRef as any).currentTasks = null;
        }`;

code = code.replace(cancelTarget, cancelReplacement);

fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("Done");
