// static/js/documents-alpine.js - Alpine.js Application Logic with Uppy

function documentsApp() {
    return {
        // State
        currentFolderId: 'root',
        fileList: [],
        selectedItem: null,
        selectedFileContent: null,
        loadingFileContent: false,
        breadcrumb: [{ id: 'root', name: 'Root' }],
        loading: false,
        
        // Modals
        showUploadModal: false,
        showFolderModal: false,
        newFolderName: '',
        
        // Search
        searchQuery: '',
        searchResults: [],
        showSearchResults: false,
        fuse: null,
        allDocuments: [],
        
        // Stats
        stats: {
            files: 0,
            folders: 0,
            chunks: 0
        },
        
        // Toast
        toast: {
            show: false,
            message: '',
            type: 'success'
        },

        // Custom Modal State
        showModal: false,
        modalTitle: '',
        modalMessage: '',
        modalType: 'info', // Can be 'info', 'success', 'warning', 'error', 'confirm'
        modalConfirmAction: null, // Function to call on confirm

        // Uppy instance
        uppy: null,
        canUpload: false,

        // Initialize
        async init() {
            await this.loadStats();
            await this.loadFileList();
            this.setupKeyboardShortcuts();

            // Listen for the custom event indicating Uppy modules are loaded
            document.addEventListener('uppyLoaded', () => {
                console.log('Uppy modules confirmed loaded via event.');
                if (!this.uppy) {
                    this.initUppy();
                }
            });
        },

        // Stats
        async loadStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                this.stats = {
                    files: data.total_files,
                    folders: data.total_folders,
                    chunks: data.total_chunks
                };
            } catch (error) {
                console.error('Error loading stats:', error);
                this.showToast('Failed to load statistics', 'error');
            }
        },

        // File List
        async loadFileList() {
            this.loading = true;
            try {
                const response = await fetch(`/api/folder/${this.currentFolderId}`);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                this.fileList = data.contents;
                this.breadcrumb = data.breadcrumb || [{ id: 'root', name: 'Root' }];
                
                // Update all documents for search
                this.updateAllDocuments();
                
            } catch (error) {
                console.error('Error loading file list:', error);
                this.showToast('Failed to load files', 'error');
            } finally {
                this.loading = false;
            }
        },

        // Navigation
        async navigateToFolder(folderId) {
            this.currentFolderId = folderId;
            this.selectedItem = null;
            this.clearSearch();
            await this.loadFileList();
        },

        // Item Selection
        async selectItem(item) {
            this.selectedItem = item;
            this.selectedFileContent = null; // Clear previous content
            if (item && item.type === 'file') {
                await this.fetchFileContent(item.id);
            }
        },

        async fetchFileContent(fileId) {
            this.loadingFileContent = true;
            try {
                const fileInfo = this.fileList.find(item => item.id === fileId);
                if (!fileInfo) {
                    throw new Error("File information not found.");
                }

                if (fileInfo.extension?.toLowerCase() === 'pdf') {
                    // For PDFs, we don't fetch content as text, but prepare for direct rendering
                    this.selectedFileContent = null; // Clear any previous text content
                    this.$nextTick(() => {
                        this.renderPdf(`/api/file-content/${fileId}`);
                    });
                } else {
                    const response = await fetch(`/api/file-content/${fileId}`);
                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    this.selectedFileContent = data.content;
                }
            } catch (error) {
                console.error('Error fetching file content:', error);
                this.showToast(error.message || 'Failed to load file content', 'error');
                this.selectedFileContent = null;
            } finally {
                this.loadingFileContent = false;
            }
        },

        formatFileContent(content, extension) {
            const textExtensions = ['txt', 'csv', 'json'];
            const markdownExtensions = ['md'];
            const nonDisplayableExtensions = ['docx', 'pptx'];

            if (markdownExtensions.includes(extension?.toLowerCase())) {
                // Use Showdown.js for markdown formatting
                const converter = new showdown.Converter();
                return converter.makeHtml(content);
            } else if (textExtensions.includes(extension?.toLowerCase())) {
                return content;
            } else if (nonDisplayableExtensions.includes(extension?.toLowerCase())) {
                return `Content for .${extension} files cannot be displayed directly in the browser.`;
            } else if (extension?.toLowerCase() === 'pdf') {
                // PDF rendering is handled by renderPdf function, so return empty string here
                return '';
            } else {
                return `Content for .${extension} files cannot be displayed.`;
            }
        },

        // File Operations
        async createFolder() {
            if (!this.newFolderName.trim()) {
                this.showToast('Please enter a folder name', 'error');
                return;
            }

            try {
                const response = await fetch('/api/folder', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.newFolderName,
                        parent_id: this.currentFolderId
                    })
                });

                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }

                this.showFolderModal = false;
                this.newFolderName = '';
                await this.loadFileList();
                await this.loadStats();
                this.showToast('Folder created successfully', 'success');

            } catch (error) {
                console.error('Error creating folder:', error);
                this.showToast(error.message || 'Failed to create folder', 'error');
            }
        },

        async deleteItem(item) {
            this.showCustomModal(
                'Confirm Deletion',
                `Are you sure you want to delete "${item.name}"? This action cannot be undone.`, 
                'confirm',
                async () => {
                    try {
                        const endpoint = item.type === 'folder' ? `/api/folder/${item.id}` : `/api/file/${item.id}`;
                        const response = await fetch(endpoint, { method: 'DELETE' });
                        const data = await response.json();
        
                        if (data.error) {
                            throw new Error(data.error);
                        }
        
                        if (this.selectedItem?.id === item.id) {
                            this.selectedItem = null;
                        }
        
                        await this.loadFileList();
                        await this.loadStats();
                        this.showToast(data.message, 'success');
        
                    } catch (error) {
                        console.error('Delete error:', error);
                        this.showToast(error.message || 'Failed to delete item', 'error');
                    }
                }
            );
        },

        uploadToFolder(folderId) {
            this.currentFolderId = folderId;
            this.openUploadModal(); // Use the new method with retry logic
        },

        // Search
        updateAllDocuments() {
            this.allDocuments = this.fileList
                .filter(item => item.type === 'file')
                .map(item => ({
                    id: item.id,
                    filename: item.name,
                    extension: item.extension,
                    content: item.name
                }));

            this.fuse = new Fuse(this.allDocuments, {
                keys: ['filename', 'content'],
                threshold: 0.4,
                includeScore: true
            });
        },

        async performSearch() {
            if (!this.searchQuery.trim()) {
                this.clearSearch();
                return;
            }

            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: this.searchQuery,
                        n_results: 10
                    })
                });

                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }

                this.searchResults = data.results.map(result => ({
                    ...result,
                    score: result.similarity_score
                }));
                this.showSearchResults = true;

            } catch (error) {
                console.error('Search error:', error);
                this.showToast(error.message || 'Search failed', 'error');
            }
        },

        clearSearch() {
            this.searchQuery = '';
            this.searchResults = [];
            this.showSearchResults = false;
        },

        highlightSearchTerms(text, query) {
            if (!query) return text;
            
            const words = query.toLowerCase().split(' ');
            let highlightedText = text;
            
            words.forEach(word => {
                if (word.length > 2) {
                    const regex = new RegExp(`(${word})`, 'gi');
                    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
                }
            });
            
            
            
            return highlightedText;
        },

        // Uppy Integration - FIXED VERSION
        initUppy() {
            console.log('Initializing Uppy...');
            
            if (this.uppy) {
                this.uppy.close();
                this.uppy = null;
            }

            if (!window.UppyModules) {
                console.error('Uppy modules are not loaded');
                this.showToast('Upload library not available', 'error');
                return;
            }

            const { Uppy, Dashboard, XHRUpload } = window.UppyModules;
            const currentApp = this;

            try {
                this.uppy = new Uppy({
                    restrictions: {
                        maxFileSize: 50 * 1024 * 1024,
                        maxNumberOfFiles: 10,
                        allowedFileTypes: ['.pdf', '.docx', '.pptx', '.txt', '.md', '.csv', '.json']
                    },
                    autoProceed: false,
                    allowMultipleUploadBatches: false
                });

                // Use Dashboard plugin (inline mode)
                this.uppy.use(Dashboard, {
                    target: '#uppy-container',
                    inline: true,
                    note: 'Supports: PDF, DOCX, PPTX, TXT, MD, CSV, JSON (Max 50MB each)',
                    height: 200,
                    proudlyDisplayPoweredByUppy: false,
                    locale: {
                        strings: {
                            dropPasteFiles: 'Drop files here or %{browseFiles}',
                            browseFiles: 'browse'
                        }
                    }
                });

                this.uppy.use(XHRUpload, {
                    endpoint: '/api/upload',
                    method: 'POST',
                    formData: true,
                    fieldName: 'file',
                    timeout: 30 * 1000,
                    getResponseData: function(responseText, response) {
                        try {
                            return JSON.parse(responseText);
                        } catch (e) {
                            return { error: 'Invalid response from server' };
                        }
                    }
                });

                // Event handlers
                this.uppy.on('file-added', function(file) {
                    console.log('File added:', file.name);
                    currentApp.canUpload = currentApp.uppy.getFiles().length > 0;
                });

                this.uppy.on('file-removed', function(file) {
                    console.log('File removed:', file.name);
                    currentApp.canUpload = currentApp.uppy.getFiles().length > 0;
                });

                this.uppy.on('upload', function(data) {
                    console.log('Upload started:', data);
                    // Set folder_id in meta
                    currentApp.uppy.setMeta({
                        folder_id: currentApp.currentFolderId
                    });
                });

                this.uppy.on('upload-success', function(file, response) {
                    console.log('Upload success:', file.name, response);
                });

                this.uppy.on('complete', function(result) {
                    console.log('Upload complete:', result);
                    
                    if (result.failed.length > 0) {
                        currentApp.showToast(`Failed to upload ${result.failed.length} files`, 'error');
                    }
                    
                    if (result.successful.length > 0) {
                        const totalChunks = result.successful.reduce((sum, file) => {
                            return sum + (file.response?.body?.total_chunks || 0);
                        }, 0);
                        
                        currentApp.showToast(`Successfully uploaded ${result.successful.length} files! Created ${totalChunks} chunks`, 'success');
                        
                        // Refresh file list and stats
                        currentApp.loadFileList();
                        currentApp.loadStats();
                        
                        // Close modal after delay
                        setTimeout(() => {
                            currentApp.showUploadModal = false;
                            currentApp.uppy.clear();
                            currentApp.canUpload = false;
                        }, 1500);
                    }
                });

                this.uppy.on('upload-error', function(file, error, response) {
                    console.error('Upload error:', file?.name, error, response);
                    
                    let errorMessage = 'Upload failed';
                    if (response?.body?.error) {
                        errorMessage = response.body.error;
                    } else if (error?.message) {
                        errorMessage = error.message;
                    }
                    
                    currentApp.showToast(errorMessage, 'error');
                });

                this.uppy.on('restriction-failed', function(file, error) {
                    console.error('Restriction failed:', file?.name, error);
                    currentApp.showToast(error.message || 'File validation failed', 'error');
                });

                console.log('Uppy initialized successfully');

            } catch (error) {
                console.error('Error initializing Uppy:', error);
                this.showToast('Failed to initialize upload interface', 'error');
            }
        },

        triggerUpload() {
            if (this.uppy && this.uppy.getFiles().length > 0) {
                console.log('Triggering upload for', this.uppy.getFiles().length, 'files');
                this.uppy.upload();
            } else {
                this.showToast('Please select files first', 'error');
            }
        },

        // Modal management
        async openUploadModal() {
            this.showUploadModal = true;
            // Wait for modal to be visible, then initialize Uppy if not already
            await this.$nextTick();
            if (!this.uppy) {
                this.initUppy();
            }
        },

        closeUploadModal() {
            this.showUploadModal = false;
            if (this.uppy) {
                this.uppy.clear();
                this.canUpload = false;
            }
        },

        // Utility Functions
        getFileIcon(item) {
            if (!item) return 'fas fa-file';
            if (item.type === 'folder') return 'fas fa-folder';
            
            const iconMap = {
                'pdf': 'fas fa-file-pdf',
                'docx': 'fas fa-file-word',
                'pptx': 'fas fa-file-powerpoint',
                'txt': 'fas fa-file-alt',
                'md': 'fas fa-file-alt',
                'csv': 'fas fa-file-csv',
                'json': 'fas fa-file-code'
            };
            return iconMap[item.extension] || 'fas fa-file';
        },

        getIconColor(item) {
            if (!item) return 'text-gray-500';
            if (item.type === 'folder') return 'text-gray-500';
            
            const colorMap = {
                'pdf': 'text-red-600',
                'docx': 'text-blue-600',
                'pptx': 'text-orange-500',
                'txt': 'text-gray-500',
                'md': 'text-gray-500',
                'csv': 'text-green-600',
                'json': 'text-purple-600'
            };
            return colorMap[item.extension] || 'text-gray-500';
        },

        getFileDetails(item) {
            if (item.type === 'folder') {
                return `Folder • ${this.formatDate(item.created_at)}`;
            }
            return `${item.extension.toUpperCase()} • ${this.formatFileSize(item.size)} • ${item.chunk_count || 0} chunks`;
        },

        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        formatDate(dateString) {
            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
            return new Date(dateString).toLocaleString(undefined, options);
        },

        showToast(message, type = 'success') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;

            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        },

        // PDF Rendering
        async renderPdf(pdfUrl) {
            console.log('pdfjsLib:', typeof pdfjsLib);
            console.log('renderPdf called with URL:', pdfUrl);
            const container = document.getElementById('pdf-viewer');
            if (!container) {
                console.error('PDF viewer container not found.');
                this.showToast('PDF viewer not available', 'error');
                return;
            }
            container.innerHTML = ''; // Clear previous content

            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                console.log('PDF loaded successfully. Number of pages:', pdf.numPages);

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    console.log('Rendering page:', pageNum);
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    console.log(`Canvas dimensions for page ${pageNum}: ${canvas.width}x${canvas.height}`);
                    canvas.style.display = 'block'; // Ensure canvases stack vertically
                    canvas.style.marginBottom = '10px'; // Add some space between pages
                    container.appendChild(canvas);
                    console.log('Canvas appended for page:', pageNum);

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport,
                    };
                    await page.render(renderContext).promise;
                    console.log('Page rendered to canvas:', pageNum);
                }
                this.showToast('PDF rendered successfully', 'success');
            } catch (error) {
                console.error('Error rendering PDF:', error);
                this.showToast('Failed to render PDF: ' + error.message, 'error');
            }
        },

        // Custom Modal Functions
        showCustomModal(title, message, type = 'info', confirmAction = null) {
            this.modalTitle = title;
            this.modalMessage = message;
            this.modalType = type;
            this.modalConfirmAction = confirmAction;
            this.showModal = true;
        },

        hideModal() {
            this.showModal = false;
            this.modalTitle = '';
            this.modalMessage = '';
            this.modalType = 'info';
            this.modalConfirmAction = null;
        },

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.key === 'f') {
                    event.preventDefault();
                    this.$refs.searchInput.focus();
                }

                if (event.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }
    };
}