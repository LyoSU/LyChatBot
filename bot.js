const {
  tdlib
} = require('./helpers')

const fromChat = parseInt(process.env.FROM_CHAT)
const toChat = parseInt(process.env.TO_CHAT)

let messageIds = []
let messageAlbumIds = {}

setInterval(() => {
  if (messageIds.length > 0) {
    tdlib.forwardMessages(toChat, fromChat, messageIds, true).then((result) => {
      console.log(result)
    }).catch(console.error)
    messageIds = []
  }
  if (Object.keys(messageAlbumIds) > 0) {
    for (const keys in messageAlbumIds) {
      const ids = messageAlbumIds[keys]

      tdlib.forwardMessages(toChat, fromChat, ids, true).then((result) => {
        console.log(result)
      }).catch(console.error)
    }
    messageAlbumIds = {}
  }
}, 200)

// tdlib.airgram.use((ctx, next) => {
//   console.log(ctx)
//   return next()
// })

tdlib.airgram.on('updateMessageSendSucceeded', ({ update, airgram }, next) => {
  if (update.message.chatId === toChat && update.message.canBeForwarded) {
    tdlib.pinChatMessage(toChat, update.message.id, true)
  }
})

tdlib.airgram.on('updateNewMessage', async ({ update, airgram }) => {
  if (update.message.chatId === fromChat) {
    if (update.message.mediaAlbumId > 0) {
      if (!messageAlbumIds[update.message.mediaAlbumId]) messageAlbumIds[update.message.mediaAlbumId] = []
      messageAlbumIds[update.message.mediaAlbumId].push(update.message.id)
    } else {
      messageIds.push(update.message.id)
    }
  }

  const me = await airgram.api.getMe()

  if (update.message.content._ === 'messagePinMessage' && update.message.senderUserId === me.response.id) {
    tdlib.deleteMessages(toChat, [update.message.id]).catch(console.error)
  }
})
