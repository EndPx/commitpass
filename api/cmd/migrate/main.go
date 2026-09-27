package main

import (
	"context"
	"github.com/EndPx/commitpass/api/internal/application"
	"github.com/EndPx/commitpass/api/migrations"
	"log"
	"time"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := application.OpenDatabase(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err = migrations.Apply(ctx, pool); err != nil {
		log.Fatal("Application migration failed: ", err)
	}
	log.Print("Application database migrations applied")
}
