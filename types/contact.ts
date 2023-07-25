export interface Contact {
    id: number,
    phoneNumber?: String,
    email?: String,
    linkedId?: number,
    linkPrecedence: ("primary" | "secondary"),
    createdAt: Date,
    updatedAt: Date,
    deletedAt?: Date
}