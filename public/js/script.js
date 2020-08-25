// Store last pool statistics
var lastStats;
var previousBlock = false;
// Get current miner address
function getCurrentAddress() {
    var urlWalletAddress = location.search.split('wallet=')[1] || 0;
    var address = urlWalletAddress || docCookies.getItem('mining_address');
    return address;
}

// Pulse live update

function pulseLiveUpdate(){
    var stats_update = document.getElementById('statsUpdated');
    stats_update.style.transition = 'opacity 100ms ease-out';
    stats_update.style.opacity = 1;
    setTimeout(function(){
        stats_update.style.transition = 'opacity 7000ms linear';
        stats_update.style.opacity = 0;
    }, 500);
}
function playSound(){
    if(localStorage.getItem("soundEnabled") !== 'true') {
        return;
    }
	try{
	document.getElementById('blockAudioAlert').play();
	} catch(e) {

	}
}
// Update live informations
function updateLiveStats(data) {
    pulseLiveUpdate();   
    lastStats = data;
    if (lastStats && lastStats.pool && lastStats.pool.totalMinersPaid.toString() == '-1'){
        lastStats.pool.totalMinersPaid = 0;
    }
    updateIndex();
    if (currentPage) currentPage.update();
    
    if(
    	(
	    	data.pool.blocks.length <= 0 || 
	    	previousBlock === false || 
	    	previousBlock ===  parseInt(data.pool.blocks[1])
    	) === false
    ){ // We found new block
     playSound();
    }
    
    previousBlock = parseInt(data.pool.blocks[1]);
}

// Update global informations
function updateIndex(){
    updateText('coinSymbol', lastStats.config.symbol);
    updateText('g_networkHashrate', getReadableHashRateString(lastStats.network.difficulty / lastStats.config.coinDifficultyTarget) + '/sec');
    updateText('g_poolHashrate', getReadableHashRateString(lastStats.pool.hashrate) + '/sec');    
    if (lastStats.miner && lastStats.miner.hashrate){
         updateText('g_userHashrate', getReadableHashRateString(lastStats.miner.hashrate) + '/sec');
    } else{
        updateText('g_userHashrate', 'N/A');
    }    
    updateText('poolVersion', lastStats.config.version);
}

// Load live statistics
function loadLiveStats(reload, polling) {
    if(xhrLiveStats && !reload) {
        return;
    }
    var apiURL = window.config.api + '/stats';
    
    if (xhrLiveStats) {
        xhrLiveStats.abort()
    }

    var address = getCurrentAddress();

    let data = {}
    if(address) {
        data.address=encodeURIComponent(address);
    }

    if(polling) {
        data.polling = true
    }
     xhrLiveStats = $.ajax({
        url: apiURL,
        data : data,
        dataType: 'json',
        cache: false,
        type: 'get',
    }).done(function(data){
        updateLiveStats(data);
    }).always(function(){
        xhrLiveStats = null;
        timerFetchLiveStats = setTimeout(function() {
            loadLiveStats(false,true)
        },5000);
    });
}

// Fetch live statistics
var xhrLiveStats;
var timerFetchLiveStats;
var soundEnabled = true;


// Initialize
$(function(){

    var urlWalletAddress = location.search.split('wallet=')[1] || false
    if(urlWalletAddress) {
        docCookies.setItem('mining_address', urlWalletAddress)
        window.location.href = "./#worker_stats"
        return
    }
    // Add support informations to menu    
    if (typeof telegram !== 'undefined' && telegram) {
        $('#menu-content').append('<li><a target="_new" href="'+telegram+'"><i class="fa fa-telegram"></i> <span tkey="telegram">Telegram group</span></a></li>');
    }
    if (typeof discord !== 'undefined' && discord) {
        $('#menu-content').append('<li><a target="_new" href="'+discord+'"><i class="fab fa-discord"></i> <span tkey="discord">Discord</span></a></li>');
    }
    if (typeof email !== 'undefined' && email) {
        $('#menu-content').append('<li><a target="_new" href="mailto:'+email+'"><i class="fa fa-envelope"></i> <span tkey="contactUs">Contact Us</span></a></li>');
    }
    if (typeof langs !== 'undefined' && langs) {
        $('#menu-content').append('<div id="mLangSelector"></div>');
		renderLangSelector();
    }
    

	var afterTest = function(e){
		if(e && e.hasOwnProperty('preventDefault')) e.preventDefault();
		$('#blockAudioAlert').attr('muted',false);
	};
	
	$('#btnBlockAudioAlert').on('click',afterTest); 
	
	$(document).ready(function(){


		$('#blockAudioAlert').attr('muted',true);
		var playbutts = document.querySelector('#blockAudioAlert').play();

		if (playbutts) playbutts.then(afterTest).catch(error => {$('#btnBlockAudioAlert').click();});
		else afterTest();	



		loadLiveStats();
        routePage(() => {
            loadLiveStats(true, true)
        });
	});
	
    
});
