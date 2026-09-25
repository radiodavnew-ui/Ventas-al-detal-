package com.example.data.model

import java.util.UUID

data class Product(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val priceUsd: Double,
    val imageUri: String = "",
    val category: String = "General",
    val createdAt: Long = System.currentTimeMillis(),
    val stock: Int = 100
)
