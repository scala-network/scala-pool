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
	document.getElementById('blockAudioAlert').play();
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
function loadLiveStats(reload) {
    var apiURL = api + '/stats';
    
    var address = getCurrentAddress();
    if (address) { apiURL = apiURL + '?address=' + encodeURIComponent(address); }

    if (xhrLiveStats) xhrLiveStats.abort();
    
    $.get(apiURL, function(data){        
        updateLiveStats(data);
        if(typeof disableSidebarRouting === 'undefined' || disableSidebarRouting ===false){
	        if (!reload){
	        	routePage(fetchLiveStats);
	        }
        }
    });
}

// Fetch live statistics
var xhrLiveStats;
var timerFetchLiveStats;
function fetchLiveStats() {
    if(timerFetchLiveStats && xhrLiveStats){
        return;
    }
    var apiURL = api + '/live_stats';

    var address = getCurrentAddress();
    if (address) { apiURL = apiURL + '?address=' + encodeURIComponent(address); }
    
    xhrLiveStats = $.ajax({
        url: apiURL,
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        updateLiveStats(data);
    }).always(function(){
        xhrLiveStats = null;
        timerFetchLiveStats = setTimeout(fetchLiveStats,5000);
    });
}

// Initialize
$(function(){
    
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
		loadLiveStats();
	};
	
	$('#btnBlockAudioAlert').on('click',afterTest); 
	
	$(document).ready(function(){
		var playbutts = document.querySelector('#blockAudioAlert').play();
		if (playbutts) playbutts.then(()=>afterTest).catch(error => {$('#btnBlockAudioAlert').click();});
		else afterTest();
	});
	
    
});
