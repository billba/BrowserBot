import { UniversalChat, WebChatConnector, BrowserBot, IChatMessageMatch, reply } from 'prague-botframework-browserbot';

const webChat = new WebChatConnector()
window["browserBot"] = webChat.botConnection;

import { IStateMatch, ChatState } from 'prague-botframework-browserbot';

// It's overkill for BrowserBot use ChatState, but it opens the door to reusing all/most of the code
// in a Bot Framework Connected web service where all other fields would be relevant.

// Add state to your bot here:

interface UserInConversationState {
    vip?: boolean,
    promptKey?: string
}

type BotData = ChatState<undefined, undefined, undefined, undefined, UserInConversationState>;

const botData: BotData = {
    bot: undefined,
    channel: undefined,
    user: undefined,
    conversation: undefined,
    userInConversation: {}
}

type B = IStateMatch<BotData> & IChatMessageMatch;

const browserBot = new BrowserBot<BotData>(new UniversalChat(webChat.chatConnector), botData);

import { matchRegExp, re, IRegExpMatch } from 'prague-botframework-browserbot';
import { first, rule, run } from 'prague-botframework-browserbot';

// LUIS

import { LuisModel } from 'prague-botframework-browserbot';

// WARNING: don't check your LUIS id/key in to your repo!

const luis = new LuisModel('id', 'key');

// Prompts

import { PromptRules, TextPrompts, createChoice, createConfirm } from 'prague-botframework-browserbot';

const promptRules: PromptRules<B> = {
    'Comment': rule<B>(
            match => fetch(`https://jsonplaceholder.typicode.com/comments/${match.text}`)
                .then(response => response.json())
                .then(json => match.reply(json.name))
        )
}

const prompts = new TextPrompts<B>(
    promptRules,
    (match) => match.data.userInConversation.promptKey,
    (match, promptKey) => {
        match.data.userInConversation.promptKey = promptKey
    }
);

const introRule = rule<B>(
    matchRegExp(/I am (.*)/i),
    first(
        rule(match => match.groups[1] === 'Bill', match => {
            match.reply(`You are very handsome, ${match.groups[1]}`);
            match.data.userInConversation.vip = true;
        }),
        match => {
            match.reply(`Nice to meet you, ${match.groups[1]}`);
            match.data.userInConversation.vip = false;
        }
    )
);

const appRule = first<B>(

    prompts,

    re(/show comment/, match => {
        match.reply("Which comment would you like to see (0-99)?");
        prompts.setPrompt(match, 'Comment');
    }),

    introRule,

    luis.best({
        'singASong': match =>
            match.reply(`Let's sing ${match.entityValues('song')[0]}`),
        'findSomething': match =>
            match.reply(`Okay let's find a ${match.entityValues('what')[0]} in ${match.entityValues('where')[0]}`)
    }),

    re(/Howdy|Hi|Hello|Wassup/i, match => match.reply("Howdy")),

    match => match.reply(`I don't understand you${ match.data.userInConversation.vip ? ", sir" : ""}.`),
);

browserBot.run({
    message: appRule
});
