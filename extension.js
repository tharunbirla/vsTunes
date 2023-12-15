const vscode = require('vscode');
const axios = require('axios');
const { spawn } = require('child_process');

let mplayerProcess;
let playPauseButton;
let titleText;
let titleTimer;

let togglePlayPauseCommand;

async function activate(context) {
    let disposable = vscode.commands.registerCommand('vstunes.searchTunes', async function () {
        const searchQuery = await vscode.window.showInputBox({
            placeHolder: 'Enter your search query',
            prompt: 'Search for songs on YouTube',
        });

        if (searchQuery) {
            try {
                const response = await axios.get(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(searchQuery)}&pretty=1`);

                // Extract titles and videoIds from the response
                const results = response.data;
                const titles = results.map(result => result.title);
                const videoIds = results.map(result => result.videoId);

                if (titles.length > 0) {
                    const selectedTitle = await vscode.window.showQuickPick(titles, {
                        placeHolder: 'Select a title',
                    });

                    if (selectedTitle) {
                        const selectedVideoIndex = titles.indexOf(selectedTitle);
                        const selectedVideoId = videoIds[selectedVideoIndex];

                        if (selectedVideoId) {
                            const audioUrl = `https://vid.puffyan.us/latest_version?id=${selectedVideoId}&itag=140`;

                            // Dispose of the existing command if it exists
                            if (togglePlayPauseCommand) {
                                togglePlayPauseCommand.dispose();
                            }

                            // Add button to the status bar for controlling playback
                            playPauseButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
                            playPauseButton.text = '$(debug-pause)';
                            playPauseButton.tooltip = 'Play/Pause';
                            playPauseButton.command = 'vstunes.togglePlayPause';
                            playPauseButton.show();

                            // Song title text
                            titleText = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
                            titleText.text = selectedTitle.substring(0, 15);
                            titleText.tooltip = selectedTitle;
                            titleText.show();

                            // Command for toggling play/pause
                            togglePlayPauseCommand = vscode.commands.registerCommand('vstunes.togglePlayPause', () => {
                                if (mplayerProcess) {
                                    mplayerProcess.stdin.write(' ');
                                    updatePlayPauseButton();
                                }
                            });

                            context.subscriptions.push(togglePlayPauseCommand);

                            function updatePlayPauseButton() {
                                if (playPauseButton) {
                                    if (playPauseButton.text === '$(debug-pause)') {
                                        playPauseButton.text = '$(play)';
                                    } else {
                                        playPauseButton.text = '$(debug-pause)';
                                    }
                                }
                            }
                            
                            // Start mplayer process
                            mplayerProcess = spawn('mplayer', ['-cache', '9999', '-really-quiet', audioUrl], {
                                detached: true,
                                stdio: 'pipe',
                            });

                            // Handle mplayer process exit
                            mplayerProcess.on('exit', () => {
                                mplayerProcess = null;
                                playPauseButton.hide();
                                titleText.hide();
                                clearInterval(titleTimer);
                            });

                            // Listen for the end event to change the button to play when the song ends
                            mplayerProcess.on('end', () => {
                                updatePlayPauseButton();
                            });

                            playPauseButton.show();
                            titleText.show();

                            // Set up a timer to scroll the song title
                            let index = 0;
                            titleTimer = setInterval(() => {
                                index = (index + 1) % (selectedTitle.length - 10);
                                titleText.text = selectedTitle.substring(index, index + 10);
                            }, 500);
                        } else {
                            vscode.window.showErrorMessage(`No videoId found for "${selectedTitle}"`);
                        }
                    }
                } else {
                    vscode.window.showInformationMessage(`No results found for "${searchQuery}"`);
                }
            } catch (error) {
                console.error('Error fetching search results:', error.message);
                vscode.window.showErrorMessage('Error fetching search results. Please try again later.');
            }
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {
    // Terminate the mplayer process when deactivating the extension
    if (mplayerProcess) {
        mplayerProcess.stdin.write('q\n');
    }
    clearInterval(titleTimer);

    // Dispose of the command when deactivating the extension
    if (togglePlayPauseCommand) {
        togglePlayPauseCommand.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
