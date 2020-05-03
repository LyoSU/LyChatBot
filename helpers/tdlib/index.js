const path = require('path')
const fs = require('fs')
const { Airgram, Auth, prompt } = require('airgram')

const tdDirectory = path.resolve(__dirname, 'data')
if (process.env.NODE_ENV === 'production') fs.rmdirSync(`${tdDirectory}/db`, { recursive: true })

const tdLibFile = process.platform === 'win32' ? 'tdjson/tdjson' : 'libtdjson/libtdjson'
const airgram = new Airgram({
  apiId: process.env.API_ID || 2834,
  apiHash: process.env.API_HASH || '68875f756c9b437a8b916ca3de215815',
  command: `${tdDirectory}/${tdLibFile}`,
  databaseDirectory: `${tdDirectory}/db`,
  logVerbosityLevel: 0
})

airgram.use(new Auth({
  // phoneNumber: () => prompt('Please enter your phone number:\n'),
  // code: () => prompt('Please enter the secret code:\n'),
  // password: () => prompt('Please enter the password:\n')
  token: process.env.BOT_TOKEN
}))

function searchPublicChat (username) {
  return new Promise((resolve, reject) => {
    airgram.api.searchPublicChat({
      username
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))
      resolve(response)
    })
  })
}

function getUser (userId) {
  return new Promise((resolve, reject) => {
    airgram.api.getUser({
      userId
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))
      const user = {
        id: response.id,
        first_name: response.firstName,
        last_name: response.lastName,
        username: response.username,
        language_code: response.languageCode
      }

      resolve(user)
    })
  })
}

function getChat (chatId) {
  return new Promise((resolve, reject) => {
    airgram.api.getChat({
      chatId
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))

      console.log(response)

      const chat = {
        id: response.id
      }

      const chatTypeMap = {
        chatTypePrivate: 'private',
        chatTypeBasicGroup: 'group',
        chatTypeSupergroup: 'supergroup',
        chatTypeSecret: 'secret'
      }

      chat.type = chatTypeMap[response.type._]

      if (['private', 'secret'].includes(chat.type)) {
        getUser(chat.id).then((user) => {
          resolve(user)
        })
      } else {
        chat.title = response.title

        if (response.type.isChannel && response.type.isChannel === true) chat.type = 'channel'

        resolve(chat)
      }
    })
  })
}

function getSupergroupFullInfo (chatId) {
  return new Promise((resolve, reject) => {
    airgram.api.getSupergroupFullInfo({
      supergroupId: chatId.toString().replace('-100', '')
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))
      resolve(response)
    })
  })
}

function getChatStatisticsUrl (chatId) {
  return new Promise((resolve, reject) => {
    airgram.api.getChatStatisticsUrl({
      chatId,
      is_dark: true
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))
      resolve(response)
    })
  })
}

function forwardMessages (chatId, fromChatId, messageIds, asAlbum) {
  return new Promise((resolve, reject) => {
    airgram.api.forwardMessages({
      chatId,
      fromChatId,
      messageIds,
      asAlbum
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))
      resolve(response)
    })
  })
}

function getMessages (chatId, messageIds) {
  const tdlibMessageIds = messageIds.map((id) => id * Math.pow(2, 20))

  return new Promise((resolve, reject) => {
    airgram.api.getMessages({
      chatId,
      messageIds: tdlibMessageIds
    }).then(({ response }) => {
      if (response._ === 'error') return reject(new Error(`[TDLib][${response.code}] ${response.message}`))

      const messages = response.messages.map((messageInfo) => {
        if (!messageInfo) return {}
        return new Promise((resolve, reject) => {
          const message = {
            message_id: messageInfo.id / Math.pow(2, 20),
            date: messageInfo.date
          }
          const messagePromise = []
          const replyToMessageId = messageInfo.replyToMessageId / Math.pow(2, 20)

          if (messageInfo.replyToMessageId) messagePromise.push(getMessages(chatId, [replyToMessageId]))
          Promise.all(messagePromise).then((replyMessage) => {
            if (replyMessage && replyMessage[0] && replyMessage[0][0] && Object.keys(replyMessage[0][0]).length !== 0) message.reply_to_message = replyMessage[0][0]

            const chatIds = [
              messageInfo.chatId,
              messageInfo.senderUserId
            ]

            let forwarderId

            if (messageInfo.forwardInfo && messageInfo.forwardInfo.origin.senderUserId) forwarderId = messageInfo.forwardInfo.origin.senderUserId
            if (messageInfo.forwardInfo && messageInfo.forwardInfo.origin.chatId) forwarderId = messageInfo.forwardInfo.origin.chatId

            if (forwarderId) chatIds.push(forwarderId)

            const chatInfoPromise = chatIds.map(getChat)

            Promise.all(chatInfoPromise).then((chats) => {
              const chatInfo = {}
              chats.map((chat) => {
                chatInfo[chat.id] = chat
              })

              message.chat = chatInfo[messageInfo.chatId]
              message.from = chatInfo[messageInfo.senderUserId]

              if (messageInfo.forwardInfo) {
                if (chatInfo[forwarderId]) {
                  if (!chatInfo[forwarderId].type) message.forward_from = chatInfo[forwarderId]
                  else message.forward_from_chat = chatInfo[forwarderId]
                }
                if (messageInfo.forwardInfo.origin.senderName) message.forward_sender_name = messageInfo.forwardInfo.origin.senderName
              }

              let entities

              if (messageInfo.content.text) {
                message.text = messageInfo.content.text.text
                entities = messageInfo.content.text.entities
              }
              if (messageInfo.content.caption) {
                message.caption = messageInfo.content.caption.text
                entities = messageInfo.content.caption.entities
              }

              if (entities) {
                message.entities = entities.map((entityInfo) => {
                  const typeMap = {
                    textEntityTypeMention: 'mention',
                    textEntityTypeHashtag: 'hashtag',
                    textEntityTypeCashtag: 'cashtag',
                    textEntityTypeBotCommand: 'bot_command',
                    textEntityTypeUrl: 'url',
                    textEntityTypeEmailAddress: 'email',
                    textEntityTypeBold: 'bold',
                    textEntityTypeItalic: 'italic',
                    textEntityTypeUnderline: 'underline',
                    textEntityTypeStrikethrough: 'strikethrough',
                    textEntityTypeCode: 'code',
                    textEntityTypePre: 'pre',
                    textEntityTypePreCode: 'pre_code',
                    textEntityTypeTextUrl: 'text_link',
                    textEntityTypeMentionName: 'text_mention',
                    textEntityTypePhoneNumber: 'phone_number'
                  }

                  const entity = {
                    length: entityInfo.length,
                    offset: entityInfo.offset,
                    type: typeMap[entityInfo.type._]
                  }

                  if (entity.type === 'text_link') entity.url = entityInfo.type.url
                  if (entity.type === 'text_mention') entity.user = entityInfo.type.userId

                  return entity
                })
              }

              resolve(message)
            })
          })
        })
      })

      Promise.all(messages).then(resolve)
    }).catch(reject)
  })
}

module.exports = {
  airgram,
  searchPublicChat,
  getUser,
  getChat,
  getSupergroupFullInfo,
  forwardMessages,
  getChatStatisticsUrl,
  getMessages
}
