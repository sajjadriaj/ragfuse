// static/js/chat-alpine.js - Chat Alpine.js Application Logic

function chatApp() {
    return {
        // Core state
        messages: [],
        messageInput: '',
        isTyping: false,
        currentConversationId: null,
        webSearchEnabled: false,
        
        // LLM Selection
        selectedLlmProvider: 'openai', // Default to openai
        availableLlmProviders: [
            { id: 'openai', name: 'OpenAI' },
            { id: 'claude', name: 'Claude' },
            { id: 'gemini', name: 'Gemini' },
            { id: 'ollama', name: 'Ollama' }
        ],

        // Context & Documents
        selectedFolderId: '',
        selectedDocuments: [],
        availableFolders: [],
        allDocuments: [],
        filteredDocuments: [],
        
        // UI state
        showDocumentSelector: false,
        documentSearchQuery: '',
        conversations: [],
        loadingConversations: false,
        
        // Search
        documentFuse: null,
        
        // Stats (shared with documents page)
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

        // Initialize
        async init() {
            await this.loadStats();
            await this.loadFolders();
            await this.loadDocuments();
            this.applyFolderFilter(); // Apply initial filter after loading documents
            await this.loadConversations();
            await this.loadLlmSettings(); // Load LLM settings
            this.setupKeyboardShortcuts();
            this.setupAutoScroll();
            console.log("Available LLM Providers:", this.availableLlmProviders);
        },

        // Stats (reuse from documents)
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
            }
        },

        // Load available folders for context selection
        async loadFolders() {
            try {
                const response = await fetch('/api/all-documents-and-folders');
                const data = await response.json();
                
                if (!data.error) {
                    this.availableFolders = data.folders;
                    // Ensure 'Root Folder' is always present and selected by default if no other folder is selected
                    if (!this.availableFolders.some(f => f.id === 'root')) {
                        this.availableFolders.unshift({ id: 'root', name: 'Root Folder' });
                    }
                    if (!this.selectedFolderId) {
                        this.selectedFolderId = 'root';
                    }
                }
            } catch (error) {
                console.error('Error loading folders:', error);
            }
        },

        // Load all documents for selection
        async loadDocuments() {
            try {
                const response = await fetch('/api/all-documents-and-folders');
                const data = await response.json();
                
                if (!data.error) {
                    this.allDocuments = data.files;
                    this.filteredDocuments = [...this.allDocuments];
                    
                    // Initialize Fuse for document search
                    this.documentFuse = new Fuse(this.allDocuments, {
                        keys: ['name', 'extension'],
                        threshold: 0.4,
                        includeScore: true
                    });
                }
            } catch (error) {
                console.error('Error loading documents:', error);
            }
        },

        // Conversation Management
        async loadConversations() {
            this.loadingConversations = true;
            try {
                const response = await fetch('/api/conversations');
                const data = await response.json();
                
                if (!data.error) {
                    this.conversations = data.conversations.map(conv => ({
                        ...conv,
                        // The title is already provided by the backend
                        preview: this.generateConversationPreview(conv),
                        // Map selected_documents IDs to actual document objects
                        selected_documents_details: conv.selected_documents.map(docId => 
                            this.allDocuments.find(doc => doc.id === docId)
                        ).filter(Boolean) // Filter out any undefined if doc not found
                    }));
                }
            } catch (error) {
                console.error('Error loading conversations:', error);
            } finally {
                this.loadingConversations = false;
            }
        },

        async loadConversation(conversationId) {
            try {
                const response = await fetch(`/api/conversations/${conversationId}`);
                const data = await response.json();
                
                if (!data.error) {
                    this.currentConversationId = conversationId;
                    this.messages = data.messages || [];
                    this.scrollToBottom();
                }
            } catch (error) {
                console.error('Error loading conversation:', error);
                this.showToast('Failed to load conversation', 'error');
            }
        },

        async deleteConversation(conversationId) {
            this.showCustomModal(
                'Confirm Deletion',
                'Are you sure you want to delete this conversation? This action cannot be undone.',
                'confirm',
                async () => {
                    try {
                        const response = await fetch(`/api/conversations/${conversationId}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
        
                        if (data.error) {
                            throw new Error(data.error);
                        }
        
                        this.showToast('Conversation deleted successfully', 'success');
        
                        // Remove from local list
                        this.conversations = this.conversations.filter(c => c.conversation_id !== conversationId);
        
                        // If the deleted one was active, clear the chat
                        if (this.currentConversationId === conversationId) {
                            this.newConversation();
                        }
                    } catch (error) {
                        console.error('Error deleting conversation:', error);
                        this.showToast(error.message || 'Failed to delete conversation', 'error');
                    }
                }
            );
        },

        newConversation() {
            this.currentConversationId = null;
            this.messages = [];
            this.messageInput = '';
        },

        // Message handling
        async sendMessage() {
            if (!this.messageInput.trim() || this.isTyping) return;

            const userMessage = {
                role: 'user',
                content: this.messageInput.trim(),
                timestamp: new Date().toISOString()
            };

            this.messages.push(userMessage);
            const messageToSend = this.messageInput.trim();
            this.messageInput = '';
            this.isTyping = true;
            
            // Auto-resize textarea back to single line
            const textarea = document.querySelector('.chat-input');
            if (textarea) {
                textarea.style.height = '40px';
            }

            this.scrollToBottom();

            console.log('Sending message with webSearchEnabled:', this.webSearchEnabled);

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: messageToSend,
                        conversation_id: this.currentConversationId,
                        folder_id: this.selectedFolderId,
                        selected_documents: this.selectedDocuments.map(doc => doc.id),
                        llm_provider: this.selectedLlmProvider,
                        web_search_enabled: this.webSearchEnabled
                    })
                });

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }

                const botMessage = {
                    role: 'bot',
                    content: data.response,
                    sources: data.sources || [],
                    context_parts: data.context_parts || [],
                    timestamp: new Date().toISOString()
                };

                this.messages.push(botMessage);
                this.currentConversationId = data.conversation_id;
                
                // Update conversations list
                await this.loadConversations();

            } catch (error) {
                console.error('Chat error:', error);
                const errorMessage = {
                    role: 'bot',
                    content: 'Sorry, I encountered an error processing your message. Please try again.',
                    timestamp: new Date().toISOString()
                };
                this.messages.push(errorMessage);
                this.showToast(error.message || 'Failed to send message', 'error');
            } finally {
                this.isTyping = false;
                this.scrollToBottom();
            }
        },

        askExample(question) {
            this.messageInput = question;
            this.sendMessage();
        },

        clearCurrentChat() {
            this.showCustomModal(
                'Clear Chat History',
                'Are you sure you want to clear the current chat history? This action cannot be undone.',
                'confirm',
                () => {
                    this.messages = [];
                    this.currentConversationId = null;
                    this.messageInput = '';
                    this.showToast('Chat history cleared', 'success');
                }
            );
        },

        // Document selection
        searchDocuments() {
            if (!this.documentSearchQuery.trim()) {
                // If search query is empty, just ensure filteredDocuments reflects the current folder selection
                this.applyFolderFilter(false); // Pass false to prevent re-triggering searchDocuments
                return;
            }

            if (this.documentFuse) {
                const results = this.documentFuse.search(this.documentSearchQuery);
                this.filteredDocuments = results.map(result => result.item);
            }
        },

        toggleDocument(doc) {
            const isSelected = this.isDocumentSelected(doc);
            if (isSelected) {
                this.selectedDocuments = this.selectedDocuments.filter(d => d.id !== doc.id);
            } else {
                this.selectedDocuments.push(doc);
            }
        },

        isDocumentSelected(doc) {
            return this.selectedDocuments.some(d => d.id === doc.id);
        },

        removeDocument(doc) {
            this.selectedDocuments = this.selectedDocuments.filter(d => d.id !== doc.id);
        },

        applyDocumentSelection() {
            this.showDocumentSelector = false;
            this.documentSearchQuery = '';
            this.filteredDocuments = [...this.allDocuments];
        },

        // Context management
        updateContext() {
            // When folder context changes, filter documents
            console.log('Context updated to folder:', this.selectedFolderId);
            this.applyFolderFilter();
        },

        applyFolderFilter(callSearchDocuments = true) {
            if (this.selectedFolderId === 'root') {
                this.filteredDocuments = [...this.allDocuments];
            } else {
                this.filteredDocuments = this.allDocuments.filter(
                    (doc) => doc.folder_id === this.selectedFolderId
                );
            }
            // Reset search query and re-apply search if any
            this.documentSearchQuery = '';
            if (callSearchDocuments) {
                this.searchDocuments();
            }
        },

        // Export/Share functionality
        exportConversation() {
            if (this.messages.length === 0) return;

            const conversationText = this.messages.map(msg => {
                const timestamp = this.formatTime(msg.timestamp);
                const role = msg.role === 'user' ? 'You' : 'Assistant';
                return `[${timestamp}] ${role}: ${msg.content}`;
            }).join('\n\n');

            const blob = new Blob([conversationText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `conversation-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('Conversation exported successfully', 'success');
        },

        shareConversation() {
            if (this.messages.length === 0) return;

            const conversationText = this.messages.map(msg => {
                const role = msg.role === 'user' ? 'You' : 'Assistant';
                return `${role}: ${msg.content}`;
            }).join('\n\n');

            if (navigator.share) {
                navigator.share({
                    title: 'RAGFuse Conversation',
                    text: conversationText
                });
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(conversationText).then(() => {
                    this.showToast('Conversation copied to clipboard', 'success');
                });
            } else {
                this.showToast('Sharing not supported in this browser', 'error');
            }
        },

        // UI Helpers
        handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        },

        autoResize(event) {
            const textarea = event.target;
            textarea.style.height = '40px';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const container = document.getElementById('messages-container');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        },

        setupAutoScroll() {
            // Watch for new messages and auto-scroll
            this.$watch('messages', () => {
                this.scrollToBottom();
            });
        },

        // Formatting helpers
        formatMessage(content) {
            // Use Showdown.js for markdown formatting
            const converter = new showdown.Converter();
            return converter.makeHtml(content);
        },

        formatTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },

        formatDate(dateString) {
            if (!dateString) return 'Unknown';
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) return 'Today';
            if (diffDays === 2) return 'Yesterday';
            if (diffDays <= 7) return `${diffDays} days ago`;
            return date.toLocaleDateString();
        },

        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        // Utility functions (shared with documents)
        getFileIcon(item) {
            if (item.type === 'folder') return 'fas fa-folder';
            if (item.type === 'web') return 'fas fa-globe'; // Icon for web sources
            
            // Handle source objects which have 'filename' instead of 'name' or 'extension'
            const filename = item.filename || item.name || '';
            const extension = item.extension || filename.split('.').pop() || '';

            const iconMap = {
                'pdf': 'fas fa-file-pdf',
                'docx': 'fas fa-file-word',
                'pptx': 'fas fa-file-powerpoint',
                'txt': 'fas fa-file-alt',
                'md': 'fas fa-file-alt',
                'csv': 'fas fa-file-csv',
                'json': 'fas fa-file-code'
            };
            return iconMap[extension.toLowerCase()] || 'fas fa-file';
        },

        // Conversation helpers
        generateConversationTitle(conversation) {
            // Use the first user message as the title
            const firstUserMessage = conversation.messages ? conversation.messages.find(m => m.role === 'user') : null;
            if (firstUserMessage && firstUserMessage.content) {
                return firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
            }
            return 'New Conversation';
        },

        // LLM Settings
        async loadLlmSettings() {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (data.llm_provider) {
                    this.selectedLlmProvider = data.llm_provider;
                }
            } catch (error) {
                console.error('Error loading LLM settings:', error);
                this.showToast('Failed to load LLM settings', 'error');
            }
        },

        generateConversationPreview(conversation) {
            if (conversation.messages && conversation.messages.length > 1) {
                const lastBotMessage = [...conversation.messages].reverse().find(m => m.role === 'bot');
                if (lastBotMessage) {
                    return lastBotMessage.content.substring(0, 80) + (lastBotMessage.content.length > 80 ? '...' : '');
                }
            }
            return 'No messages yet';
        },

        // Toast notifications
        showToast(message, type = 'success') {
            this.toast = {
                show: true,
                message,
                type
            };

            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
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

        // Keyboard shortcuts
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case 'n':
                            e.preventDefault();
                            this.newConversation();
                            break;
                        case 'k':
                            e.preventDefault();
                            document.querySelector('.chat-input')?.focus();
                            break;
                        case 's':
                            e.preventDefault();
                            this.exportConversation();
                            break;
                        case 'd':
                            e.preventDefault();
                            this.showDocumentSelector = true;
                            break;
                    }
                }
                
                if (e.key === 'Escape') {
                    this.showDocumentSelector = false;
                }
            });
        }
    };
}