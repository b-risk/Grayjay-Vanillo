### Grayjay Vanillo
This plugin adds support for the platform [Vanillo](https://vanillo.tv/), allowing you to use it in Grayjay.

### Installation
You can install the plugin by scanning this QR code:  
![QR Code](https://raw.githubusercontent.com/anomalyco/Grayjay-Vanillo/refs/heads/main/Imgs/qr-code.png)

Alternatively, you can add it manually by using this link:
```
grayjay://plugin/https://raw.githubusercontent.com/anomalyco/Grayjay-Vanillo/refs/heads/main/VanilloConfig.json
```

### Features
- [x] Home feed (categories: commentary, gaming, film & animation, music, entertainment, education)
- [x] Video playback (HLS + DASH sources)
- [x] Channel/profile pages
- [x] Channel video listings with pagination
- [x] Channel playlists
- [x] Channel posts
- [x] Post details and comments
- [x] Search (videos and profiles)
- [x] Video comments
- [x] Infinite scroll pagination

### Contributions
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.

### Signing
```bash
# Generate keypair
ssh-keygen -t rsa -b 2048 -m PEM -f ./private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./private-key.pem)"

# Run the sign script (use git bash on Windows):
sh ./sign-script.sh ./VanilloScript.js ./VanilloConfig.json
```
