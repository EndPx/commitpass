package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/EndPx/commitpass/api/internal/application"
	"github.com/EndPx/commitpass/api/internal/indexed"
	"github.com/EndPx/commitpass/packages/shared"
)

func main() {
	project, err := shared.Project()
	if err != nil {
		log.Fatal(err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	closeIndexer, err := indexed.Register(mux)
	if err != nil {
		log.Fatal(err)
	}
	defer closeIndexer()
	closeApplication, err := application.Register(mux)
	if err != nil {
		log.Fatal(err)
	}
	defer closeApplication()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"status": "ok", "service": "api", "project": project,
		}); err != nil {
			log.Printf("health response: %v", err)
		}
	})

	server := &http.Server{
		Addr:              net.JoinHostPort("", port),
		Handler:           application.CORS(mux, os.Getenv("CORS_ALLOWED_ORIGINS")),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      25 * time.Second,
		MaxHeaderBytes:    32 << 10,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()

	log.Printf("%s API listening on %s", project.Name, server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
