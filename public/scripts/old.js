var io = io.connect();
//io.emit('ready', {hey: 'server'}, function(data) {
//    alert("success: "+data.success+"header: "+data.header);
//});

io.on('news', function (data) {
    console.log(data);
    io.emit('my other event', { my: 'data' });
});

// canvas request for all browsers
window.requestAnimFrame = (function(callback) {
    return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function(callback) {
    window.setTimeout(callback, 1000 / 30); // 30 frames per second
    };
})();
var io;
var pollOneH = 0;
var poll1;
var text;
var potValue;
var prevPotValue;
//var onOff = false;
var toggleVal = 0;
function animation(poll1,text)
{
var canvas = document.getElementById("myCanvas");
var content = canvas.getContext("2d");
// clear canvas
content.clearRect(0, 0, 460, 540);
content.fillStyle = 'black';
content.textAlign = 'center';
content.font = '20pt Calibri';
// make the wobbely values stop
if(pollOneH*2 > prevPotValue+2 || pollOneH*2 < prevPotValue-2){
    prevPotValue = potValue;
    potValue = pollOneH*2;
}
content.fillText('Potmeter value: ' + potValue, text.x, text.y);
// render graph
content.fillStyle = 'orange';
content.fillRect(poll1.x,(poll1.y-poll1.h),poll1.w,poll1.h);
content.fill();
// request new frame
requestAnimFrame(function() {
  if(poll1.h < pollOneH){

  }
  else if(poll1.h > pollOneH){
      poll1.h -= (poll1.h - pollOneH)*.15;
  }
  text.y = (poll1.y - poll1.h) - 5;
  animation(poll1,text);
});
}
function initSocketIO(){
  //io = io.connect();
  io.on('onconnection', function(value) {
  pollOneH = value.pollOneValue/2; // recieve start poll value from server
  initPoll();
  initButton();
  initSlider();
  // recieve changed values by other client from server
  io.on('updateData', function (recievedData) {
  pollOneH = recievedData.pollOneValue/2; // recieve start poll value from server
  });
  });
}
function initPoll(){
  poll1 = {
  x: 10,
  y: 540,
  w: 440,
  h: 0
  }
  text = {
  x:poll1.w/2,
  y:100
  }
  potValue = pollOneH*2;
  prevPotValue = potValue;
  animation(poll1,text);
}
function initButton(){
  $( "#check" ).button();
}
function initSlider(){
  $( "#slider" ).slider({
    min:0, max:255,
    change: function(event,ui) {
      io.emit('sliderval',ui.value);
    }
  });
}
window.onload = function() {
initSocketIO();
};
$(document).ready(function() {
$('#check').click(function() {
toggleVal += 1;
toggleVal %= 2;
io.emit('buttonval',toggleVal);
});
});