const dirBase = {
    html: `file://${__dirname}/html/`,
    icon: './recursos/toolConfig.png'
  },
  fs = require('fs'),
  fileConfig = require('./package.json'),
  CNC = require('./lib/main.js'),
  electron = require('electron'),
  app = electron.app,
  BrowserWindow = electron.BrowserWindow,
  ipcMain = electron.ipcMain,
  dialog = electron.dialog,
  Menu = electron.Menu,
  Tray = electron.Tray,
  powerSaveBlocker = electron.powerSaveBlocker,
  globalShortcut = electron.globalShortcut
  ;
app.setName('CNC-ino');
// to not display the default menu to start
Menu.setApplicationMenu(Menu.buildFromTemplate([]));

app.on('window-all-closed', () => {
  CNC.end();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

var mainWindow = null;
app.on('ready', () => {
  //var appIcon = new Tray(dirBase.icon);
  //appIcon.setToolTip('This is my application.');
  //appIcon.setContextMenu(contextMenu);

  mainWindow = new BrowserWindow({
    experimentalCanvasFeatures: true, // Default false
    disableAutoHideCursor: false, // Default false
    autoHideMenuBar: false, // Default false
    backgroundColor: '#F5F5F5', // Default #FFF 
    useContentSize: true,
    skipTaskbar: false, // Default false
    alwaysOnTop: false, // Default false
    fullscreen: false, // Default false
    frame: true, // Default true
    type: 'normal', // Default normal . On Linux, desktop, dock, toolbar, splash, notification.  On OS X, desktop, textured
    //webPreferences 
    icon: dirBase.icon,
    center: true,
    minWidth: 560,
    minHeight: 450,
    //maxWidth   :  960, 
    //maxHeight  :  600,
    width: 800,
    height: 600,
    title: fileConfig.name
  });
  mainWindow.loadURL(dirBase.html + 'index.html');
  //mainWindow.on('page-title-updated',  () => { console.log('title'); });
  mainWindow.on('closed', () => {
    globalShortcut.unregisterAll();
    mainWindow = null;
    if (process.platform != 'darwin') {
      app.quit();
    }
  });

  // Open the devtools.
  //mainWindow.openDevTools();
  //mainWindow.setProgressBar(0.7);

  // ver como informar ala capa superior de que termino
  mainWindow.on('blur', () => { globalShortcut.unregisterAll(); });
  mainWindow.on('focus', () => { if (CNC.Arduino.comName !== "") { registerGlobalShortcut(); } });
});//ready

ipcMain.on('arduino', (event, arg) => {
  CNC.Arduino.reSet((obj) => {
    if (CNC.debug.ipc.arduino){ console.log("send", 'arduino-res', obj); }
    if (CNC.Arduino.comName !== "") { registerGlobalShortcut(); }
    event.sender.send('arduino-res', obj);
  });
});

ipcMain.on('open-file', (event, data) => {
  if (!CNC.Arduino.working) {
    console.log("open-file", data);
    globalShortcut.unregisterAll();
    event.sender.send('open-file-tick', {info:'Abriendo archivo...'});
    CNC.setFile(
      data.fileDir || dialog.showOpenDialog({
        title: fileConfig.name,
        filters: [
          { name: 'File CNC', extensions: ['gcode', 'gif', 'jpg', 'jpeg','png','nc'] },
          { name: 'G-Code', extensions: ['gcode'] },
          { name: 'Imagen', extensions: ['gif', 'jpg', 'jpeg', 'png'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      }),
      data.initialLine = data.initialLine || [0, 0, 0],
      { // CallBack
        fileImg: (config) => {
          console.log('Config for img2gcode.');
          event.sender.send('show-prefs-img2gcode-res', config);
        },
        tick: (data) => {
          event.sender.send('open-file-tick', data);
        },
        error: (data) => {
          event.sender.send('close-conex', data);
        },
        finished: (File) => {
          console.log('File gcode loaded. and crate viwe por gcode...');
          event.sender.send('open-file-res', File);
        }
      }
    ) // CNC.setFile
  } else {
    event.sender.send('config-save-res', { type: 'error', message: 'Esta tabajando.' });
  }
});

ipcMain.on('send-command', (event, arg) => {
  CNC.sendCommand(arg, (dataReceived) => {
    if (CNC.debug.arduino.sendCommand) { console.log("sendCommand: ", dataReceived); }
    event.sender.send('close-conex', dataReceived);
  });
});

ipcMain.on('send-start', (event, arg) => {
  if (!CNC.Arduino.working) {
    if (CNC.debug.ipc.sendStart) console.log('send-start', arg);
    //prevent-display-sleep
    //prevent-app-suspension
    var id = powerSaveBlocker.start('prevent-app-suspension');
    if (CNC.debug.app.prevent) console.log('prevent-app-suspension', powerSaveBlocker.isStarted(id));
    CNC.start(arg, (data) => {
      if (data.lineRunning !== false) {
        event.sender.send('add-line', { nro: data.lineRunning, line: CNC.File.gcode[data.lineRunning] });
        if (CNC.debug.ipc.console) console.log("I: %s - Ejes: %s - Result: %s", data.lineRunning, CNC.File.gcode[data.lineRunning].ejes, data.steps);
      } else {
        powerSaveBlocker.stop(id);
        mainWindow.setProgressBar(0);
        event.sender.send('close-conex', { type: 'none', steps: data.steps });
        if (CNC.debug.ipc.console) console.log("Finish.");
      }
    });
  } else { console.log('Working in other project.') }
});

ipcMain.on('taksBar-progress', (event, arg) => { mainWindow.setProgressBar(arg); });
ipcMain.on('show-lineTable', (event, arg) => { event.sender.send('show-lineTable') });

ipcMain.on('about', (event, arg) => {
  let chosen = dialog.showMessageBox(mainWindow, {
    cancelId: 0, type: 'info', buttons: ['Aceptar'],
    title: 'Acerca De', message: 'CNC-ino, Arduino y NodeJS', detail: stringAbout
  });
  // if (chosen == 0)  mainWindow.destroy();
});

ipcMain.on('show-prefs', (event, argType) => {
  if (!CNC.Arduino.working) {
    globalShortcut.unregisterAll();
    CNC.configFile.read().then((data) => {
      event.sender.send(`show-prefs-${argType}-res`, data);
    });
  } else {
    event.sender.send('config-save-res', { type: 'error', message: 'Esta tabajando.' });
  }
});
ipcMain.on('config-save-send', (event, arg) => {
  globalShortcut.unregisterAll();
  CNC.configFile.save(arg, (data) => {
    event.sender.send('config-save-res', data);
  });
});

ipcMain.on('contextmenu-enabled', (event, arg) => {
  event.sender.send('contextmenu-enabled-res', arg);
});

/*
Event: ‘suspend’
Event: ‘resume’
Event: ‘on-ac’
Event: ‘on-battery’
*/

function registerGlobalShortcut() {
  if (!CNC.Arduino.working) {
    CNC.configFile.read().then((file) => {
      let manalSteps = file.manalSteps;
      function globalShortcutSendComand(cmd) {
        CNC.sendCommand(cmd, (dataReceived) => {
          if (CNC.debug.arduino.sendCommand) { console.log(dataReceived); }
          mainWindow.webContents.send('close-conex', dataReceived);
        });
      }
      globalShortcut.register('q', () => {
        globalShortcutSendComand(`0,0,${manalSteps}`);
        console.log(`Q key pressed and sent 0,0,${manalSteps} command.`);
      });
      globalShortcut.register('e', () => {
        globalShortcutSendComand(`0,0,-${manalSteps}`);
        console.log(`E key pressed and sent 0,0,-${manalSteps} command.`);
      });
      globalShortcut.register('d', () => {
        globalShortcutSendComand(`-${manalSteps},0,0`);
        console.log(`D key pressed and sent -${manalSteps}0,0 command.`);
      });
      globalShortcut.register('a', () => {
        globalShortcutSendComand(`${manalSteps},0,0`);
        console.log(`A key pressed and sent ${manalSteps},0,0 command.`);
      });
      globalShortcut.register('w', () => {
        globalShortcutSendComand(`0,-${manalSteps},0`);
        console.log(`W key pressed and sent 0,-${manalSteps},0 command.`);
      });
      globalShortcut.register('s', () => {
        globalShortcutSendComand(`0,${manalSteps},0`);
        console.log(`S key pressed and sent 0,${manalSteps},0 command.`);
      });
      globalShortcut.register('Space', () => {
        globalShortcutSendComand('0,0,0');
        console.log("SPACE key pressed and sent '0,0,0' command.");
      });
      //globalShortcut.register('Up', () => { globalShortcutSendComand('0,10,0'); });
      //globalShortcut.register('Down', () => { globalShortcutSendComand('0,-10,0'); });
      //globalShortcut.register('Left', () => { globalShortcutSendComand('10,0,0'); });
      //globalShortcut.register('Right', () => { globalShortcutSendComand('-10,0,0'); });
    });
  }
}

var stringAbout = `Proyecto de Router CNC casero con ideas, mano de obra y programacion propia dentro de lo posible.
    \tCNC-ino: v${fileConfig.version}.
    \tElectronJS: ${process.versions.electron}.
    \tRenderer: ${process.versions.chrome}.
    \tRAM: ${process.getProcessMemoryInfo().workingSetSize}Mb.
    Marani Cesar Juan.
    Marani Matias Ezequiel.`
  ;