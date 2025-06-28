function settingsApp() {
    return {
        settings: {
            llm_provider: 'openai',
            openai_api_key: '',
            openai_model: 'gpt-3.5-turbo',
            claude_api_key: '',
            claude_model: 'claude-3-sonnet-20240229',
            gemini_api_key: '',
            gemini_model: 'gemini-pro',
            ollama_endpoint: 'http://localhost:11434',
            ollama_model: 'llama2',
            custom_llm_prompt: '',
            
        },
        stats: {
            files: 0,
            folders: 0,
            chunks: 0
        },
        toast: {
            show: false,
            message: '',
            type: 'success'
        },

        async init() {
            await this.loadStats();
            await this.loadSettings();
        },

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

        async loadSettings() {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                // Merge loaded settings with defaults, ensuring all keys are present
                this.settings = { 
                    ...this.settings, 
                    ...data,
                    custom_llm_prompt: data.custom_llm_prompt || 'Given the following context:\n\n{{context}}\n\nAnswer the question: {{query}}'
                };
            } catch (error) {
                console.error('Error loading settings:', error);
                this.showToast('Failed to load settings', 'error');
            }
        },

        async saveSettings() {
            try {
                const response = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.settings)
                });
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                this.showToast('Settings saved successfully!', 'success');
            } catch (error) {
                console.error('Error saving settings:', error);
                this.showToast(error.message || 'Failed to save settings', 'error');
            }
        },

        showToast(message, type = 'success') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;

            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        }
    };
}
