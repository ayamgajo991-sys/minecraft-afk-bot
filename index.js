require('dotenv').config(); // PENTING: Membaca token aman dari file .env
const mineflayer = require('mineflayer');
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- SETUP WEB SERVER UNTUK UPTIMEROBOT ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Minecraft Bot is active and running 24/7!');
});

app.listen(PORT, () => {
  console.log(`Web server aktif di port ${PORT}`);
});

// --- KONFIGURASI BOT ---
const CONFIG = {
  mc: {
    host: 'relxmc.com',
    port: 25565,
    version: '1.21.1',
    username: 'Sayaanakbaik',
    auth: 'offline',
    password: 'haekal09'
  },
  discord: {
    token: process.env.DISCORD_TOKEN, // Aman dari bocor ke GitHub!
    channelId: '1492066167651831909'
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let mcBot;
let reconnecting = false; 
let dropInterval = null; 

function sendToDiscord(text) {
  const channel = client.channels.cache.get(CONFIG.discord.channelId);
  if (channel) channel.send(text);
}

function triggerJoinQueue() {
  if (!mcBot) return;
  sendToDiscord('🚀 **Mengirim perintah `/joinq ecocpvp`...**');
  mcBot.chat('/joinq ecocpvp');
}

function executeDropProcess() {
  if (!mcBot) return;
  
  const spawnerBlock = mcBot.findBlock({
    matching: mcBot.registry.blocksByName.spawner.id,
    maxDistance: 5
  });

  if (spawnerBlock) {
    mcBot.activateBlock(spawnerBlock);
  } else {
    sendToDiscord('❌ **Auto-Drop Gagal:** Tidak ada spawner di dekat bot.');
  }
}

// --- COMMAND DISCORD ---
client.on('messageCreate', (message) => {
  if (message.author.bot || message.channel.id !== CONFIG.discord.channelId) return;

  const input = message.content.trim();

  if (input.startsWith('!cmd ')) {
    const command = input.slice(5);
    if (mcBot) {
      mcBot.chat(command);
      message.reply(`📤 **Command Terkirim:** \`${command}\``);
    }
  }

  if (input === '!join') {
    triggerJoinQueue();
  }

  if (input === '!drop') {
    if (mcBot) {
      if (dropInterval) {
        message.reply('⚠️ **Auto-drop sudah aktif!** Ketik `!drop stop` untuk menghentikannya.');
        return;
      }
      
      message.reply('⚙️ **Auto-Drop Bone diaktifkan!** Bot akan membuka spawner dan mengklik tombol **Drop All** setiap 10 detik.');
      
      executeDropProcess();

      dropInterval = setInterval(() => {
        executeDropProcess();
      }, 10000);
    }
  }

  if (input === '!drop stop') {
    if (dropInterval) {
      clearInterval(dropInterval);
      dropInterval = null;
      message.reply('🛑 **Auto-Drop dihentikan.** Bot berhenti melakukan loop spawner.');
    } else {
      message.reply('❌ Auto-drop sedang tidak aktif.');
    }
  }

  if (input.startsWith('!tpa ')) {
    const target = input.split(' ')[1];
    if (mcBot) {
      mcBot.chat(`/tpa ${target}`);
      message.reply(`🚀 **Mengirim request TPA ke:** \`${target}\``);
    }
  }

  if (input.startsWith('!tpahere ')) {
    const target = input.split(' ')[1];
    if (mcBot) {
      mcBot.chat(`/tpahere ${target}`);
      message.reply(`🚀 **Mengirim request TPA Here ke:** \`${target}\``);
    }
  }

  if (input === '!tpaccept') {
    if (mcBot) {
      mcBot.chat('/tpaccept');
      message.reply(`✅ **Menerima request teleportasi!**`);
    }
  }

  if (input === '!tpdeny') {
    if (mcBot) {
      mcBot.chat('/tpdeny');
      message.reply(`❌ **Menolak request teleportasi!**`);
    }
  }
});

// --- CORE BOT MINECRAFT ---
function startMcBot() {
  if (reconnecting) return;
  
  console.log('🤖 Menghubungkan ke server Minecraft...');
  
  mcBot = mineflayer.createBot({
    host: CONFIG.mc.host,
    port: CONFIG.mc.port,
    username: CONFIG.mc.username,
    version: CONFIG.mc.version,
    auth: CONFIG.mc.auth
  });

  mcBot.on('kicked', (reason) => {
    sendToDiscord(`⚠️ **Di-kick dari server! Alasan:** \`${reason}\``);
  });

  mcBot.on('error', (err) => {
    sendToDiscord(`🚨 **Error:** \`${err.message}\``);
  });

  mcBot.once('spawn', () => {
    sendToDiscord('✅ **Bot berhasil masuk ke Lobby!**');

    setTimeout(() => {
      sendToDiscord(`🔑 **Mengirim perintah Login...**`);
      mcBot.chat(`/login ${CONFIG.mc.password}`);
      
      setTimeout(() => {
        triggerJoinQueue();
      }, 3000);
    }, 3000);
  });

  mcBot.on('windowOpen', async (window) => {
    let title = '';
    try {
      title = typeof window.title === 'string' ? window.title : JSON.stringify(window.title);
    } catch (e) {
      title = 'Unknown';
    }

    if (title.includes('Spawners') || title.includes('Spawner')) {
      setTimeout(async () => {
        try {
          await mcBot.clickWindow(13, 0, 0); 
        } catch (err) {}
      }, 800);
    }
    else if (title.includes('Storage')) {
      setTimeout(async () => {
        try {
          await mcBot.clickWindow(53, 0, 0); 
          sendToDiscord('🦴 **Berhasil mengklik Drop All di Spawner!**');
          
          setTimeout(() => {
            mcBot.closeWindow(window); 
          }, 600);
        } catch (err) {}
      }, 800);
    }
  });

  mcBot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString().trim();
    if (text) {
      sendToDiscord(`💬 \`${text}\``);
      if (text.includes('wants you to teleport to them') || text.includes('has requested that you teleport')) {
        sendToDiscord(`🔔 **PERHATIAN: Ada permintaan teleportasi masuk! Ketik \`!tpaccept\` untuk menerima.**`);
      }
    }
  });

  mcBot.on('end', () => {
    if (dropInterval) {
      clearInterval(dropInterval);
      dropInterval = null;
    }
    
    sendToDiscord('🔌 **Bot terputus. Mencoba reconnect dalam 10 detik...**');
    reconnecting = true;
    setTimeout(() => {
      reconnecting = false;
      startMcBot();
    }, 10000);
  });

  setInterval(() => {
    if (mcBot && mcBot.entity) {
      const yaw = (Math.random() - 0.5) * Math.PI;
      const pitch = (Math.random() - 0.5) * Math.PI / 2;
      mcBot.look(yaw, pitch);
    }
  }, 30000);
}

client.login(CONFIG.discord.token).then(() => {
  console.log('🤖 Bot Discord Aktif!');
  startMcBot();
});
