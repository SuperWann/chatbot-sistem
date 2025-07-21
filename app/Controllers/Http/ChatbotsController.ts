import { HttpContext } from '@adonisjs/core/build/standalone'
import { ValidationException } from "@ioc:Adonis/Core/Validator"
// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Conversation from 'App/Models/Conversation'
import Message from 'App/Models/Message'
import ChatValidator from 'App/Validators/ChatValidator'
import axios from 'axios'
import { v4 as uuid } from 'uuid';

export default class ChatbotsController {

    //untuk mengirimkan pertanyaan pada chatbot
    public async store(ctx: HttpContext) {
        const bodyRequest = ctx.request.body()
        try {
            await ctx.request.validate(ChatValidator)
        } catch (error) {
            if (error instanceof ValidationException) {
                return ctx.response.badRequest({
                    status: 400,
                    message: 'Validation failure',
                    errors: (error as any).messages.errors
                })
            }

        }
        if (bodyRequest.session_id && !(await Conversation.query().where("session_id", bodyRequest.session_id).first())) {
            return ctx.response.badRequest({
                status: 404,
                message: "not found",
                error: "conversation with your session_id is not found"
            })
        }

        const session_id = bodyRequest.session_id ?? uuid()
        console.log(session_id);

        try {

            const ress = await axios.post('https://api.majadigi.jatimprov.go.id/api/external/chatbot/send-message', {
                question: bodyRequest.message,
                additional_context: bodyRequest.additional_context ?? "",
                session_id: session_id
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Host': 'api.majadigidev.jatimprov.go.id'
                },
            })
            // console.log(ress.data);

            const conversationData = await Conversation.updateOrCreate({
                session_id: session_id
            }, {
                last_messages: ress.data.data.message[0].text
            })

            Message.createMany([
                {
                    conversationId: conversationData.id,
                    message: bodyRequest.message,
                    sender_type: "user"
                },
                {
                    conversationId: conversationData.id,
                    message: ress.data.data.message[0].text,
                    sender_type: "bot"
                }
            ])

            return ctx.response.ok({
                status: 200,
                message: "success",
                session_id,
                data: ress.data.data.message
            })
        } catch (error) {
            console.log(error);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.header);
            return ctx.response.badRequest({
                status: 400,
                message: "error",
                error
            })
        }
    }

    //untuk menampilkan semua conversation 
    public async showAllConversation(ctx: HttpContext) {
        const conversationData = await Conversation.query().preload("messages").orderBy("id", "desc")

        if (!conversationData) {
            return ctx.response.notFound({
                status: 404,
                message: "not found",
                error: "data not found"
            })
        }

        return ctx.response.ok({
            status: 200,
            message: "success",
            data: conversationData.map((conversation) => ({
                id: conversation.id,
                session_id: conversation.session_id,
                lastMessages: conversation.last_messages,
                messages: conversation.messages.map((msg) => ({
                    id: msg.id,
                    sender_type: msg.sender_type,
                    message: msg.message,
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt,
                    conversationId: msg.conversationId
                }))
            }))
        })
    }

    //untuk menampilkan conversation by id
    public async showConversationById(ctx: HttpContext) {
        const { id } = ctx.request.params()


        if (!parseInt(id)) {
            return ctx.response.badRequest({
                status: 400,
                message: "Validation failure",
                error: "invalid id",
            })
        }
        const conversationData = await Conversation.query().where('id', id).preload("messages").first()

        if (!conversationData) {
            return ctx.response.notFound({
                status: 404,
                message: "not found",
                error: "data not found"
            })
        }

        return ctx.response.ok({
            status: 200,
            message: "success",
            data: {
                id: conversationData.id,
                session_id: conversationData.session_id,
                lastMessages: conversationData.last_messages,
                messages: conversationData.messages.map((msg) => ({
                    id: msg.id,
                    sender_type: msg.sender_type,
                    message: msg.message,
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt,
                    conversationId: msg.conversationId
                }))
            }
        })
    }

    public async deleteConversation(ctx: HttpContext) {

        const { id } = ctx.request.params()

        if (!parseInt(id)) {
            return ctx.response.badRequest({
                status: 400,
                message: "Validation failure",
                error: [
                    {
                        message: "invalid id",
                    }
                ]
            })
        }

        const conversationDataQuestion = await Conversation.find(id)

        if (!conversationDataQuestion) {
            return ctx.response.notFound({
                status: 404,
                message: "not found",
                error: "data not found"
            })
        }

        await conversationDataQuestion.delete()

        return ctx.response.ok({
            status: 200,
            message: "success",
            data: {
                id: conversationDataQuestion.id,
                session_id: conversationDataQuestion.session_id,
                last_messages: conversationDataQuestion.last_messages,
                createdAt: conversationDataQuestion.createdAt,
                updatedAt: conversationDataQuestion.updatedAt
            }
        })
    }

    public async deleteMessage(ctx: HttpContext) {
        const { id } = ctx.request.params()
        const answerId = id + 1

        if (!parseInt(id)) {
            return ctx.response.badRequest({
                status: 400,
                message: "Validation failure",
                error: "invalid id",
            })
        }

        const messageData = await Message.find(id)

        if (!messageData) {
            return ctx.response.notFound({
                status: 404,
                message: "not found",
                error: "data not found"
            })
        }

        await messageData.delete()

        try {
            const messageDataAnswer = await Message.find(answerId)
            if (messageDataAnswer) {    
                await messageDataAnswer.delete()
            }
        } catch (error) {
            console.log('Answer message not found or already deleted')
        }

        return ctx.response.ok({
            status: 200,
            message: "success",
            data: { ...messageData.toJSON(), message: messageData.message }
        })
    }
}
