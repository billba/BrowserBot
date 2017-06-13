import { UniversalChat, WebChatConnector, BrowserBot, IChatMessageMatch, reply, IRule } from 'prague-botframework-browserbot';

const webChat = new WebChatConnector()
window["browserBot"] = webChat.botConnection;

import { IStateMatch, ChatState } from 'prague-botframework-browserbot';

// It's overkill for BrowserBot use ChatState, but it opens the door to reusing all/most of the code
// in a Bot Framework Connected web service where all other fields would be relevant.

// Add state to your bot here:

import { DialogStack, DialogInstance, DialogInstances, Dialogs, LocalDialogs, IDialogMatch } from 'prague-botframework-browserbot'

const ds: DialogStack = {
    getActiveDialogInstance: (match: any, currentDialogInstance: DialogInstance) =>
        match.data.userInConversation.dialogStack[currentDialogInstance.name],
    setActiveDialogInstance: (match: any, currentDialogInstance: DialogInstance, activeDialogInstance?: DialogInstance) => {
        console.log("setADI", match, currentDialogInstance, activeDialogInstance);
        match.data.userInConversation.dialogStack[currentDialogInstance.name] = activeDialogInstance
    }
}

interface UserInConversationState {
    vip?: boolean;
    dialogStack: {
        [name: string]: DialogInstance;
    };
    promptKey?: string;
}

type BotData = ChatState<undefined, undefined, undefined, undefined, UserInConversationState>;

const botData: BotData = {
    bot: undefined,
    channel: undefined,
    userInChannel: undefined,
    conversation: undefined,
    userInConversation: {
        dialogStack: {}
    }
}

const dialogDataStorage: {
        [name: string]: any[];
} = {};

const dialogInstances: DialogInstances = {
    newInstance: (name: string, dialogData: any = {}) => {
            if (!dialogDataStorage[name])
                dialogDataStorage[name] = [];
            return (dialogDataStorage[name].push(dialogData) - 1).toString();
        },
    getDialogData: (dialogInstance: DialogInstance) =>
        dialogDataStorage[dialogInstance.name][dialogInstance.instance],
    setDialogData: (dialogInstance: DialogInstance, dialogData?: any) => {
        dialogDataStorage[dialogInstance.name][dialogInstance.instance] = dialogData;
    }
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

const dialogs = new Dialogs<B>(ds);
const local = new LocalDialogs<B>(dialogInstances);

interface GameState {
    num: number,
    guesses: number
}

interface GameArgs {
    upperLimit: number;
    maxGuesses: number;
}

interface GameResponse {
    result: string;
}

dialogs.add('game', local.dialog<GameState, GameArgs, GameResponse>(
    first(
        re(/hi/, m => console.log("HI BILL")),
        run(m => console.log("game", m)),
        re(/answer/, m => {
            m.reply(`The answer is ${m.dialogData.num}`);
            // m.beginChildDialog('game', { upperLimit: 100, maxGuesses: 5 });
            console.log("before");
            m.endThisDialog({ result: "cheat" });
            console.log("after");
        }),
        re(/guesses/, m => m.reply(`You have ${m.dialogData.guesses} left.`)),
        rule(m => m.dialogData.guesses === 0, m => {
            m.reply("You're out of guesses");
            m.endThisDialog({ result: "hi"});
        }),
        rule(
            m => {
                const num = Number.parseInt(m.text);
                return !isNaN(num) && {
                    ... m as any,
                    num
                }
            },
            first(
                run(m => {
                    m.dialogData.guesses--
                }),
                rule(
                    m => m.num < m.dialogData.num,
                    m => m.reply(`That's too low. You have ${m.dialogData.guesses} guesses left`)
                ),
                rule(
                    m => m.num > m.dialogData.num,
                    m => m.reply(`That's too high. You have ${m.dialogData.guesses} guesses left`)
                ),
                m => {
                    m.reply("that's it!");
                    m.endThisDialog({ result: "success" });
                }
            )
        ),
        m => m.reply("Guess a number!")
    ),
    (match) => {
        match.reply(`Guess a number between 0 and ${match.dialogArgs.upperLimit}. You have ${match.dialogArgs.maxGuesses} guesses.`)
        return {
            num: Math.floor(Math.random() * match.dialogArgs.upperLimit),
            guesses: match.dialogArgs.maxGuesses
        }
    }
));

const introRule: IRule<B & IDialogMatch> = rule(
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

dialogs.addRule('/', first(
    // prompts,

    luis.best({
        'singASong': match =>
            match.reply(`Let's sing ${match.entityValues('song')[0]}`),
        'findSomething': match =>
            match.reply(`Okay let's find a ${match.entityValues('what')[0]} in ${match.entityValues('where')[0]}`)
    }),

    dialogs.runIfActive(),

    re(/show comment/, match => {
        match.reply("Which comment would you like to see (0-99)?");
        prompts.setPrompt(match, 'Comment');
    }),

    re(/game/, m => m.beginChildDialog('game', { upperLimit: 100, maxGuesses: 5 })),

    re(/hi/, m => console.log("HI BILL")),

    introRule,

    re(/Howdy|Hi|Hello|Wassup/i, match => match.reply("Howdy")),

    match => match.reply(`I don't understand you${ match.data.userInConversation.vip ? ", sir" : ""}.`),
));

browserBot.run({
    message: dialogs.runIfActive('/')
});
