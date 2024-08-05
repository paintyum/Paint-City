(function(){

// Elements
const playButton = document.getElementById("music-play");
const previousButton = document.getElementById("music-select-previous");
const nextButton = document.getElementById("music-select-next");

const musicName = document.getElementById("music-name");

const progressBar = document.getElementById("music-progress-bar");
const progress = document.getElementById("music-progress");
const progressTime = document.getElementById("music-progress-time");
const totalTime = document.getElementById("music-total-time");

const muteButton = document.getElementById("music-mute");

const volumeBar = document.getElementById("music-volume-bar");
const volume = document.getElementById("music-volume");
const volumeValue = document.getElementById("music-volume-value");

var audio = new Audio();

var music_array = [
	{
		src: "sounds/Bladee - Subaru Instrumental {remake}.mp3",
		name: "Bladee - Subaru Instrumental {remake}"
	},
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469287815577712/BLADEE_-_OXYGEN.mp3?ex=66b22727&is=66b0d5a7&hm=f5fc53c95e4ce25b3425f86009fba0c4d1c710eea2dbbf36e82ceea166b14c32&",
        name: "BLADEE - OXYGEN"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469298267783168/Bladee_-_jewelry_prod._Yung_Sherman_lil_sad.mp3?ex=66b2272a&is=66b0d5aa&hm=878f21b7d662c8c8299ac365e0545e5b0224995ae68f9bf8e97a92f8bcce28a3&",
        name: "Bladee - jewelry"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469299097997414/bladee_-_everything_can_goyou_already_know_rare.mp3?ex=66b2272a&is=66b0d5aa&hm=6eeb3e6aac07bee8d7e7142fc65cba93eb6d81d37362eb015bc5bfe0dec3850e&",
        name: "bladee - everything can go"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469314977759352/BLADEE_-_chainsaw_prod._bladee_audio_clip.mp3?ex=66b2272e&is=66b0d5ae&hm=a9e2fd597e4a8ba8eef3ab36645eb0944ede113ed1a7462eea614ccbdbbe15c6&",
        name: "BLADEE - chainsaw"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469419311071252/BLADEE__X._WULF_-_ICE_FLOORS.mp3?ex=66b22747&is=66b0d5c7&hm=4e4d09429aad4cc59e74b518ba2ce3958b727beefe009f4636db728fa64bf734&",
        name: "BLADEE & X. WULF - ICE FLOORS"
    },
    {
		src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469477553307708/you.mp3?ex=66b22755&is=66b0d5d5&hm=060db3d97a8cd2d8e61c8ba239f8f0a3e0bd2fd661f958b45b0d87422ee8f1df&",
		name: "Yung Shermen - you"
	},
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469491423871007/hahaha_i_love_u.mp3?ex=66b22758&is=66b0d5d8&hm=c345a1e21cdbf11e54e3e3a97ec98f5961aceffe98a3f73b374b38357c0034ff&",
        name: "Yung Shermen - hahaha i love you"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469502404431992/downloader.vevioz.com_yung_sherman_-_you_ll_be_my_audio.mp3?ex=66b2275a&is=66b0d5da&hm=f2817adc4f6fdc3fdb20bcd2956172be97e5cbce45521e4fb3e7dbf2d8fb33a3&",
        name: "Yung Shermen - you'll be my"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469607564152913/05_Dreaming_2010.mp3?ex=66b22774&is=66b0d5f4&hm=e548fa442373e3d83ff10dcbd0ed5356a06c995ee340a4c6b476d4a279c336db&",
        name: "E+E - Dreaming"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469656998219776/06_Carwash_Prod._White_Armor.mp3?ex=66b2277f&is=66b0d5ff&hm=6d1070b2e9ba3a0039c524d560f533ea8541be77cd1be0ff56793eebc8191543&",
        name: "Bladee - Carwash"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469683422203995/09_Magic_Is_Strong_Prod._White_Armor.mp3?ex=66b22786&is=66b0d606&hm=2e3455e643d1dcbe4364a381639ced1e4305cd02c3fdadde1d3e1517222cabca&",
        name: "Bladee - Magic Is Strong"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469702028267582/11_Smoke_In_My_Eyes_Outro.mp3?ex=66b2278a&is=66b0d60a&hm=79b045e010ab1240a1f161f0d79deb43e51f287d2b007af3e2715e1de20aba6b&",
        name: "Bladee - Smoke In My Eyes"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469723381338225/02_Bladeecity_ft._Yung_LeanProd._Josh_Diamond.mp3?ex=66b2278f&is=66b0d60f&hm=457ec1836e6075d2a6904d714c234c5e9ab63baee2aba515b64eb29f77cf475e&",
        name: "Yung Lean & Bladee - Bladeecity"
    },
    {
        src: "https://cdn.discordapp.com/attachments/1269468911779451034/1269469733967626300/05_Hold_Me_Down_Like_Gravity_Prod._Yung_ShermanWhite_Armor.mp3?ex=66b22792&is=66b0d612&hm=f85565f28cadf73d53c9b5e24c38f2b5b0d4afdbc2a386e7d45a6429a6886dfa&",
        name: "Ecco2k - Hold Me Down Like Gravity"
    },
];
var music_index = 0;

var started = false;
var seekingAudio = false;
var seekingVolume = false;
var wasPaused = true;

function ToTimeString(seconds) {
    var sec = Math.floor(seconds % 60);
    if (sec < 10) return Math.floor(seconds / 60) + ':0' + sec;
    return Math.floor(seconds / 60) + ':' + sec;
}

function ShowProgress() {
    progressTime.innerHTML = ToTimeString(audio.currentTime);
    progress.style.width = (audio.currentTime / audio.duration) * 100 + '%';
}
function SetMusicProgress(x) {
    x = Math.min(Math.max(x, 0), 1);
    audio.currentTime = audio.duration * x;
    ShowProgress();
}

function SetVolume(x) {
    x = Math.min(Math.max(x, 0), 1);
    audio.volume = x;
}

function PlaySong(play=true) {
	var song = music_array[music_index];
    audio.src = song.src.replace(' ', '%20');
    
    audio.load();
    if (play) audio.play();
    musicName.innerHTML = song.name;
}

function StartAudio() {
    started = true;
    
    //PlaySong("Bladee - Subaru Instrumental {remake}.mp3", "Bladee - Subaru Instrumental {remake}", false);
	PlaySong(false);
    setTimeout(function() {
        if (!seekingAudio) audio.play();
    }, 200);
    
    setInterval(ShowProgress, 200);
}

audio.addEventListener('play', () => {
    playButton.style.background = 'url("images/music-pause.png")';
});
audio.addEventListener('ended', () => {
    //playButton.style.background = 'url("images/music-pause.png")';
	music_index = (music_index + 1) % music_array.length;
	PlaySong();
});
audio.addEventListener('pause', () => {
    playButton.style.background = 'url("images/music-play.png")';
});
audio.addEventListener('durationchange', () => {
    totalTime.innerHTML = ToTimeString(audio.duration);
	ShowProgress();
});
audio.addEventListener('volumechange', () => {
    if  (audio.muted) muteButton.style.background = 'url("images/music-mute.png")';
    else muteButton.style.background = 'url("images/music-unmute.png")';
    
    volume.style.width = audio.volume * 100 + '%';
    volumeValue.innerHTML = Math.ceil(audio.volume * 100) + '%';
});

audio.volume = Number(localStorage.getItem('music-volume') ?? 1.0);
audio.muted = Number(localStorage.getItem('music-muted') ?? 0);

playButton.addEventListener('click', () => {
    if (audio.paused) audio.play();
    else audio.pause();
});
previousButton.addEventListener('click', () => {
    music_index = (music_index + music_array.length - 1) % music_array.length;
	PlaySong();
});
nextButton.addEventListener('click', () => {
    music_index = (music_index + 1) % music_array.length;
	PlaySong();
});
muteButton.addEventListener('click', () => {
    audio.muted = !audio.muted;
	localStorage.setItem('music-muted', audio.muted ? "1" : "0");
});

document.addEventListener('pointerup', function pointerup(event) {
    if (!started) StartAudio();
    event.target.removeEventListener('pointerup', pointerup);
});

progressBar.addEventListener('pointerdown', function(event) {
    if (!started) StartAudio();
    else {
        seekingAudio = true;
        wasPaused = audio.paused;
        audio.pause();
        var rect = progressBar.getBoundingClientRect();
        SetMusicProgress((event.x - rect.left) / rect.width);
    }
});
volumeBar.addEventListener('pointerdown', function(event) {
    seekingVolume = true;
    var rect = volumeBar.getBoundingClientRect();
    SetVolume((event.x - rect.left) / rect.width);
});
document.addEventListener('pointerup', function(event) {
    if (seekingAudio) {
        seekingAudio = false;
        if (!wasPaused && audio.currentTime < audio.duration) audio.play();
    }
    if (seekingVolume) {
        seekingVolume = false;
        localStorage.setItem('music-volume', audio.volume.toString());
    }
});
document.addEventListener('pointermove', function(event) {
    if (seekingAudio) {
        var rect = progressBar.getBoundingClientRect();
        SetMusicProgress((event.x - rect.left) / rect.width);
    }
    if (seekingVolume) {
        var rect = volumeBar.getBoundingClientRect();
        SetVolume((event.x - rect.left) / rect.width);
    }
});

}());