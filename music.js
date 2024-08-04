function PlayMusic() {
    let audio = document.getElementsByTagName("audio")[0];
    audio.play();
}
addEventListener("load", (event) => {
    setTimeout(PlayMusic, 3000);
});